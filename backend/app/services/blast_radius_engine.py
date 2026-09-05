"""
Blast Radius + Attack Path Analysis Engine.

Uses the existing NetworkX graph (via GraphEngine) and InvariantEngine to:
  1. Calculate blast radius when component(s) fail.
  2. Analyze potential attack paths through the topology.

No new graph system is created — all path enumeration uses GraphEngine.
"""
import datetime
from typing import Any

from app.models.component import Component
from app.models.invariant import SecurityInvariant, TrafficPath
from app.services.graph_engine import GraphEngine
from app.services.invariant_engine import InvariantEngine
from sqlalchemy.orm import Session


class BlastRadiusEngine:
    """Blast radius and attack path analysis using existing NetworkX topology."""

    # ──────────────────────────────────────────────────────────────────────────
    # Blast Radius
    # ──────────────────────────────────────────────────────────────────────────
    @classmethod
    def calculate(
        cls,
        db: Session,
        component_ids: list[str],
    ) -> dict[str, Any]:
        """
        Calculate the blast radius if the specified components were to fail.
        This is ANALYSIS ONLY — it does NOT modify any component state in DB.
        Uses existing GraphEngine dependency map + InvariantEngine verification.
        """
        graph_engine = GraphEngine(db)
        dependency_map = graph_engine.build_dependency_map(db)

        # Components to analyze
        target_comps = db.query(Component).filter(Component.id.in_(component_ids)).all()
        if not target_comps:
            return {"error": f"Components not found: {component_ids}"}

        # Collect directly affected path IDs
        affected_path_ids: set[str] = set()
        for cid in component_ids:
            affected_path_ids.update(dependency_map.get(cid, []))

        # For each affected path, run invariant verification
        all_active_paths = db.query(TrafficPath).filter(TrafficPath.is_active == True).all()
        affected_paths_detail = []
        safe_paths_detail = []
        affected_invariant_ids: set[str] = set()
        affected_services: set[str] = set()
        alternative_routes: list[dict] = []
        guaranteed_routes: list[dict] = []

        for path in all_active_paths:
            if path.id not in affected_path_ids:
                safe_paths_detail.append({"path_id": path.id, "status": path.status})
                continue

            # Simulate what happens if the components fail
            res = InvariantEngine.verify_path(db, path, graph_engine)
            verdict = res["verdict"]
            # Would be VIOLATED if the component fails (re-verify treating comps as failed)
            # Check if any component_id is in the path hops
            path_comp_ids = [
                graph_engine.node_to_component.get(n, "")
                for n in (path.current_hops or [])
            ]
            overlaps = [cid for cid in component_ids if cid in path_comp_ids]
            simulated_verdict = "VIOLATED" if overlaps else verdict

            if path.applicable_invariant_id:
                affected_invariant_ids.add(path.applicable_invariant_id)

            # Infer affected service from destination zone
            dest_zone = path.destination_node.split("-")[0] if path.destination_node else "UNKNOWN"
            affected_services.add(dest_zone)

            # Find alternate routes
            candidates = graph_engine.find_candidate_alternate_paths(db, path)
            for candidate in candidates[:3]:
                candidate_res = InvariantEngine.verify_path(db, path, graph_engine, hops=candidate)
                route_entry = {
                    "path_id": path.id,
                    "hops": candidate,
                    "verdict": candidate_res["verdict"],
                }
                alternative_routes.append(route_entry)
                if candidate_res["verdict"] == "GUARANTEED":
                    guaranteed_routes.append(route_entry)

            affected_paths_detail.append({
                "path_id": path.id,
                "path_name": path.name,
                "current_status": path.status,
                "simulated_verdict": simulated_verdict,
                "overlapping_failed_components": overlaps,
                "source": path.source_node,
                "destination": path.destination_node,
                "applicable_invariant": path.applicable_invariant_id,
                "alternative_routes_available": len(candidates),
                "guaranteed_alternatives": sum(
                    1 for c in candidates[:3]
                    if InvariantEngine.verify_path(db, path, graph_engine, hops=c).get("verdict") == "GUARANTEED"
                ),
            })

        # Affected invariant names
        affected_invs = db.query(SecurityInvariant).filter(
            SecurityInvariant.id.in_(affected_invariant_ids)
        ).all()

        # Compute critical asset exposure
        critical_assets = [
            p["destination"] for p in affected_paths_detail
            if "PCI" in (p.get("destination") or "")
            or "DATABASE" in (p.get("destination") or "")
        ]

        n_affected = len(affected_paths_detail)
        risk_level = (
            "CRITICAL" if n_affected >= 4 or len(critical_assets) > 0 else
            "HIGH" if n_affected >= 2 else
            "MEDIUM" if n_affected >= 1 else
            "LOW"
        )

        return {
            "analysis_type": "BLAST_RADIUS",
            "failed_components": component_ids,
            "affected_paths": affected_paths_detail,
            "affected_paths_count": n_affected,
            "safe_paths_count": len(safe_paths_detail),
            "affected_invariants": [
                {"id": inv.id, "name": inv.name, "severity": inv.severity}
                for inv in affected_invs
            ],
            "affected_invariants_count": len(affected_invs),
            "affected_services": list(affected_services),
            "critical_assets_exposed": critical_assets,
            "alternative_routes": alternative_routes[:10],
            "guaranteed_routes": guaranteed_routes[:5],
            "risk_level": risk_level,
            "analysis_note": (
                "Blast radius calculated using live topology and deterministic invariant analysis. "
                "No DB state was modified during this analysis."
            ),
            "analyzed_at": datetime.datetime.now(datetime.UTC).isoformat(),
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Attack Path Analysis
    # ──────────────────────────────────────────────────────────────────────────
    @classmethod
    def analyze_attack_paths(
        cls,
        db: Session,
        entry_component_id: str,
    ) -> dict[str, Any]:
        """
        Starting from an entry component, enumerate potential attack paths
        through the live topology. Identifies security controls, invariants,
        weak points, and risk per segment.

        Uses only the actual topology graph — no fictional paths generated.
        """
        graph_engine = GraphEngine(db)

        entry_comp = db.query(Component).filter(Component.id == entry_component_id).first()
        if not entry_comp:
            return {"error": f"Component '{entry_component_id}' not found."}

        entry_node = graph_engine.component_to_node.get(entry_component_id)
        if not entry_node:
            return {"error": f"Component '{entry_component_id}' has no topology node."}

        # Find all reachable paths from entry node (using NetworkX)
        all_nodes = list(graph_engine.graph.nodes())
        attack_paths: list[dict] = []

        for dest_node in all_nodes:
            if dest_node == entry_node:
                continue
            dest_comp_id = graph_engine.node_to_component.get(dest_node)
            dest_meta = graph_engine.node_metadata.get(dest_node, {})
            dest_zone = dest_meta.get("zone", "")

            # Only trace paths to valuable targets (DATABASE, PCI zones)
            if dest_zone not in ("DATABASE", "PCI", "APPLICATION"):
                continue

            paths = graph_engine.find_all_simple_paths(entry_node, dest_node, cutoff=7)
            for path_hops in paths[:3]:  # limit to 3 paths per dest
                # Gather security controls along the path
                comps_on_path = graph_engine.get_path_components(db, path_hops)
                controls = {c.type: c.status for c in comps_on_path}
                missing_controls: list[str] = []
                weak_points: list[str] = []

                # For each required control type (standard security for zone)
                expected_controls = cls._expected_controls_for_zone(dest_zone)
                for ctrl in expected_controls:
                    if ctrl not in controls:
                        missing_controls.append(ctrl)
                    elif controls[ctrl] != "HEALTHY":
                        weak_points.append(f"{ctrl} is {controls[ctrl]}")

                # Risk score for this path
                risk_score = cls._score_attack_path(
                    comps_on_path, missing_controls, weak_points
                )

                # Check against invariant
                # Find a matching TrafficPath by hops overlap
                applicable_inv = None
                for p in db.query(TrafficPath).filter(TrafficPath.is_active == True).all():
                    if (set(path_hops) & set(p.current_hops or [])) and p.applicable_invariant_id:
                        inv = db.query(SecurityInvariant).filter(
                            SecurityInvariant.id == p.applicable_invariant_id
                        ).first()
                        if inv:
                            applicable_inv = {"id": inv.id, "name": inv.name}
                            break

                attack_paths.append({
                    "entry_component": entry_component_id,
                    "entry_node": entry_node,
                    "destination_node": dest_node,
                    "destination_zone": dest_zone,
                    "destination_component": dest_comp_id,
                    "hops": path_hops,
                    "hop_count": len(path_hops),
                    "components_traversed": [c.id for c in comps_on_path],
                    "security_controls_present": list(controls.keys()),
                    "security_controls_status": controls,
                    "missing_controls": missing_controls,
                    "weak_points": weak_points,
                    "applicable_invariant": applicable_inv,
                    "risk_score": risk_score,
                    "risk_level": (
                        "CRITICAL" if risk_score >= 0.75 else
                        "HIGH" if risk_score >= 0.50 else
                        "MEDIUM" if risk_score >= 0.25 else "LOW"
                    ),
                    "exploitable": len(missing_controls) > 0 or len(weak_points) > 0,
                })

        # Sort by risk descending
        attack_paths.sort(key=lambda x: x["risk_score"], reverse=True)

        return {
            "analysis_type": "ATTACK_PATH",
            "entry_component": entry_component_id,
            "entry_component_name": entry_comp.name,
            "entry_zone": entry_comp.zone,
            "attack_paths": attack_paths,
            "total_paths_analyzed": len(attack_paths),
            "critical_paths": [p for p in attack_paths if p["risk_level"] == "CRITICAL"],
            "exploitable_paths": [p for p in attack_paths if p["exploitable"]],
            "analysis_note": (
                "Attack paths enumerated from live topology graph only. "
                "No fictional paths generated. All paths reflect actual network topology."
            ),
            "analyzed_at": datetime.datetime.now(datetime.UTC).isoformat(),
        }

    @staticmethod
    def _expected_controls_for_zone(zone: str) -> list[str]:
        """Return standard expected security controls for a destination zone."""
        if zone in ("DATABASE", "PCI"):
            return ["FIREWALL", "ENCRYPTION_GATEWAY", "WAF", "DLP", "PAM"]
        elif zone == "APPLICATION":
            return ["FIREWALL", "WAF", "IDS"]
        elif zone == "DMZ":
            return ["FIREWALL", "WAF"]
        return ["FIREWALL"]

    @staticmethod
    def _score_attack_path(
        comps: list[Component],
        missing_controls: list[str],
        weak_points: list[str],
    ) -> float:
        """Compute normalized risk score for an attack path (0.0–1.0)."""
        score = 0.0
        score += len(missing_controls) * 0.20   # each missing control = 20%
        score += len(weak_points) * 0.10        # each weak point = 10%
        failed_comps = [c for c in comps if c.status != "HEALTHY"]
        score += len(failed_comps) * 0.15
        return round(min(score, 1.0), 3)
