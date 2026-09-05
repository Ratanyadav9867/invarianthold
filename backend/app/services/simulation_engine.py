"""
Digital Twin + What-If Simulation Engine.

Creates an in-memory copy of the live topology and runs failure scenarios
against it WITHOUT touching the live database session.

CRITICAL SAFETY INVARIANT:
  - Simulation state is NEVER written to the live DB.
  - The live DB session passed in is used READ-ONLY for cloning.
  - All mutations happen inside SimulationState objects (plain dicts/copies).
  - InvariantEngine is called with overridden component data (not DB writes).
"""
import copy
import datetime
import uuid
from typing import Any

from app.models.component import Component, TopologyEdge, TopologyNode
from app.models.invariant import SecurityInvariant, TrafficPath
from app.services.graph_engine import GraphEngine
from sqlalchemy.orm import Session

# ─── In-memory simulation store (thread-safe enough for single-process) ────────
_simulations: dict[str, dict[str, Any]] = {}
_SIM_TTL_SECONDS = 1800  # 30 min TTL


def _prune_old_simulations() -> None:
    now = datetime.datetime.now(datetime.UTC)
    stale = [
        sid for sid, sim in _simulations.items()
        if (now - datetime.datetime.fromisoformat(sim["created_at"])).total_seconds() > _SIM_TTL_SECONDS
    ]
    for sid in stale:
        del _simulations[sid]


class SimulationEngine:
    """
    Digital Twin engine. Clones live state into memory, applies scenarios,
    and runs invariant verification against the simulated state.
    The live topology is NEVER modified.
    """

    # ──────────────────────────────────────────────────────────────────────────
    # Clone
    # ──────────────────────────────────────────────────────────────────────────
    @classmethod
    def create_twin(cls, db: Session, label: str = "What-If Simulation") -> dict[str, Any]:
        """
        Clone the current live system state into an isolated SimulationState.
        The returned simulation_id can be used to run scenarios against.
        """
        _prune_old_simulations()

        # Read-only snapshot of all live data
        components: dict[str, dict] = {
            c.id: {
                "id": c.id, "name": c.name, "type": c.type,
                "status": c.status, "zone": c.zone,
                "health_score": c.health_score, "latency_ms": c.latency_ms,
                "failure_count": c.failure_count,
                "capabilities": list(c.capabilities or []),
            }
            for c in db.query(Component).all()
        }

        paths: dict[str, dict] = {
            p.id: {
                "id": p.id, "name": p.name,
                "source_node": p.source_node, "destination_node": p.destination_node,
                "current_hops": list(p.current_hops or []),
                "alternate_hops": list(p.alternate_hops or []),
                "applicable_invariant_id": p.applicable_invariant_id,
                "status": p.status, "is_active": p.is_active,
                "decision_reason": p.decision_reason,
            }
            for p in db.query(TrafficPath).all()
        }

        invariants: dict[str, dict] = {
            inv.id: {
                "id": inv.id, "name": inv.name,
                "severity": inv.severity,
                "required_controls": list(inv.required_controls or []),
                "forbidden_conditions": list(inv.forbidden_conditions or []),
                "enabled": inv.enabled,
                "source_zones": list(inv.source_zones or []),
                "destination_zones": list(inv.destination_zones or []),
            }
            for inv in db.query(SecurityInvariant).all()
        }

        nodes: dict[str, dict] = {
            n.id: {"id": n.id, "label": n.label, "zone": n.zone, "component_id": n.component_id}
            for n in db.query(TopologyNode).all()
        }

        edges: list[dict] = [
            {
                "id": e.id, "source": e.source_node, "target": e.target_node,
                "latency_ms": e.latency_ms, "status": e.status,
                "packet_loss_pct": e.packet_loss_pct,
            }
            for e in db.query(TopologyEdge).all()
        ]

        sim_id = str(uuid.uuid4())
        now_iso = datetime.datetime.now(datetime.UTC).isoformat()

        sim_state = {
            "simulation_id": sim_id,
            "label": label,
            "created_at": now_iso,
            "status": "READY",
            # Live snapshot (immutable reference)
            "live_snapshot": {
                "components": copy.deepcopy(components),
                "paths": copy.deepcopy(paths),
                "invariants": copy.deepcopy(invariants),
            },
            # Simulation copy (mutated by scenarios)
            "sim_components": copy.deepcopy(components),
            "sim_paths": copy.deepcopy(paths),
            "sim_invariants": copy.deepcopy(invariants),
            "sim_nodes": nodes,
            "sim_edges": edges,
            # Node→Component reverse map
            "node_to_component": {
                n["id"]: n["component_id"]
                for n in nodes.values() if n.get("component_id")
            },
            "applied_scenarios": [],
            "verification_results": {},
            "blast_radius": None,
            "safe_routes": [],
            "run_at": None,
        }

        _simulations[sim_id] = sim_state
        return {"simulation_id": sim_id, "label": label, "status": "READY", "created_at": now_iso}

    # ──────────────────────────────────────────────────────────────────────────
    # Apply Scenarios
    # ──────────────────────────────────────────────────────────────────────────
    @classmethod
    def apply_scenario(
        cls,
        simulation_id: str,
        scenario: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Apply a failure scenario to the simulation state (NOT to live DB).

        scenario schema:
          {
            "type": "COMPONENT_FAILURE" | "LATENCY_INCREASE" | "PACKET_LOSS"
                    | "POLICY_REMOVAL" | "ROUTE_FAILURE" | "ENCRYPTION_FAILURE"
                    | "WAF_FAILURE" | "FIREWALL_FAILURE" | "SERVICE_FAILURE",
            "targets": ["FW-01", "WAF-01"],   # component IDs
            "latency_factor": 5.0,            # for LATENCY_INCREASE
            "packet_loss_pct": 15.0,          # for PACKET_LOSS
            "invariant_id": "INV-001",        # for POLICY_REMOVAL
          }
        """
        sim = _simulations.get(simulation_id)
        if not sim:
            return {"error": f"Simulation {simulation_id} not found or expired."}

        s_type = scenario.get("type", "COMPONENT_FAILURE")
        targets = scenario.get("targets", [])
        applied: list[str] = []

        if s_type in ("COMPONENT_FAILURE", "ENCRYPTION_FAILURE", "WAF_FAILURE",
                      "FIREWALL_FAILURE", "SERVICE_FAILURE"):
            for cid in targets:
                if cid in sim["sim_components"]:
                    sim["sim_components"][cid]["status"] = "FAILED"
                    sim["sim_components"][cid]["health_score"] = 0.0
                    applied.append(f"FAILED: {cid}")

        elif s_type == "LATENCY_INCREASE":
            factor = scenario.get("latency_factor", 3.0)
            for cid in targets:
                if cid in sim["sim_components"]:
                    sim["sim_components"][cid]["latency_ms"] *= factor
                    applied.append(f"LATENCY×{factor}: {cid}")

        elif s_type == "PACKET_LOSS":
            loss = scenario.get("packet_loss_pct", 10.0)
            for edge in sim["sim_edges"]:
                if edge["source"] in targets or edge["target"] in targets:
                    edge["packet_loss_pct"] = loss
                    applied.append(f"PACKET_LOSS {loss}%: edge {edge['id']}")

        elif s_type == "POLICY_REMOVAL":
            inv_id = scenario.get("invariant_id")
            if inv_id and inv_id in sim["sim_invariants"]:
                sim["sim_invariants"][inv_id]["enabled"] = False
                applied.append(f"POLICY_REMOVED: {inv_id}")

        elif s_type == "ROUTE_FAILURE":
            for pid in targets:
                if pid in sim["sim_paths"]:
                    sim["sim_paths"][pid]["status"] = "BLOCKED"
                    sim["sim_paths"][pid]["decision_reason"] = "Simulated route failure"
                    applied.append(f"ROUTE_FAILED: {pid}")

        sim["applied_scenarios"].append({
            "type": s_type, "targets": targets, "applied": applied,
            "at": datetime.datetime.now(datetime.UTC).isoformat()
        })
        sim["status"] = "SCENARIO_APPLIED"

        return {"simulation_id": simulation_id, "scenario_type": s_type, "applied": applied, "status": "SCENARIO_APPLIED"}

    # ──────────────────────────────────────────────────────────────────────────
    # Verify Against Simulation State (uses InvariantEngine logic in-memory)
    # ──────────────────────────────────────────────────────────────────────────
    @classmethod
    def run_verification(cls, simulation_id: str) -> dict[str, Any]:
        """
        Run invariant verification entirely inside the simulation state.
        NEVER writes to the live DB. Calls simulation-aware verify logic.
        """
        sim = _simulations.get(simulation_id)
        if not sim:
            return {"error": f"Simulation {simulation_id} not found or expired."}

        results: dict[str, Any] = {}
        guaranteed = 0
        violated = 0
        blocked = 0
        at_risk = 0
        no_policy = 0

        node_to_comp = sim["node_to_component"]
        sim_comps = sim["sim_components"]
        sim_invs = sim["sim_invariants"]

        for path_id, path in sim["sim_paths"].items():
            if not path.get("is_active", True):
                continue

            inv_id = path.get("applicable_invariant_id")
            inv = sim_invs.get(inv_id) if inv_id else None

            if not inv or not inv.get("enabled", True):
                results[path_id] = {
                    "verdict": "NO_POLICY",
                    "reason": "No enabled invariant assigned to this path in simulation.",
                }
                no_policy += 1
                continue

            required_controls = list(inv.get("required_controls", []))
            hops = path.get("current_hops", [])

            # Get simulated components on path
            present_types: dict[str, list[dict]] = {}
            failed_comps: list[str] = []
            healthy_comps: list[str] = []

            for node_id in hops:
                comp_id = node_to_comp.get(node_id)
                if not comp_id:
                    continue
                comp = sim_comps.get(comp_id)
                if not comp:
                    continue
                ctype = comp["type"]
                present_types.setdefault(ctype, []).append(comp)
                if comp["status"] == "FAILED" or comp["health_score"] <= 0.0:
                    failed_comps.append(comp_id)
                else:
                    healthy_comps.append(comp_id)

            missing = [c for c in required_controls if c not in present_types]
            failed_required = [
                c for c in required_controls
                if c in present_types and all(
                    p["status"] == "FAILED" or p["health_score"] <= 0.0
                    for p in present_types[c]
                )
            ]

            if missing:
                verdict = "VIOLATED"
                reason = f"SIM: Missing required controls {missing} on path {path_id}."
            elif failed_required:
                verdict = "VIOLATED"
                reason = f"SIM: Required controls {failed_required} are failed on path {path_id}."
            else:
                degraded = [
                    cid for cid, _ in [(n, sim_comps.get(node_to_comp.get(n, "")))
                                        for n in hops]
                    if sim_comps.get(node_to_comp.get(cid, ""), {}).get("health_score", 1.0) < 0.8
                ]
                if degraded:
                    verdict = "AT_RISK"
                    reason = f"SIM: Invariant verified but components degraded: {degraded}."
                else:
                    verdict = "GUARANTEED"
                    reason = f"SIM: Invariant '{inv['name']}' fully guaranteed in simulation."

            results[path_id] = {
                "verdict": verdict, "reason": reason,
                "hops": hops, "invariant_name": inv.get("name"),
                "required_controls": required_controls,
                "present_controls": list(present_types.keys()),
                "missing_controls": missing,
                "failed_components": failed_comps,
            }

            # Update path status in simulation only
            sim["sim_paths"][path_id]["status"] = verdict
            sim["sim_paths"][path_id]["decision_reason"] = reason

            if verdict == "GUARANTEED":
                guaranteed += 1
            elif verdict == "VIOLATED":
                violated += 1
            elif verdict == "BLOCKED":
                blocked += 1
            elif verdict == "AT_RISK":
                at_risk += 1
            else:
                no_policy += 1

        # Compute blast radius
        blast = cls._compute_blast_radius(sim)
        sim["blast_radius"] = blast
        sim["verification_results"] = results
        sim["run_at"] = datetime.datetime.now(datetime.UTC).isoformat()
        sim["status"] = "COMPLETED"

        total = len([p for p in sim["sim_paths"].values() if p.get("is_active", True)])
        return {
            "simulation_id": simulation_id,
            "status": "COMPLETED",
            "run_at": sim["run_at"],
            "applied_scenarios": sim["applied_scenarios"],
            "summary": {
                "total_paths": total,
                "guaranteed": guaranteed,
                "violated": violated,
                "blocked": blocked,
                "at_risk": at_risk,
                "no_policy": no_policy,
            },
            "path_results": results,
            "blast_radius": blast,
            "live_state_modified": False,  # CRITICAL: always False
        }

    @classmethod
    def _compute_blast_radius(cls, sim: dict) -> dict[str, Any]:
        """Calculate blast radius from simulation state (no DB access)."""
        violated_paths = [
            pid for pid, p in sim["sim_paths"].items()
            if p.get("status") in ("VIOLATED", "BLOCKED", "AT_RISK")
        ]
        # Components affected
        node_to_comp = sim["node_to_component"]
        affected_comp_ids: set[str] = set()
        for pid in violated_paths:
            for node_id in sim["sim_paths"][pid].get("current_hops", []):
                cid = node_to_comp.get(node_id)
                if cid:
                    affected_comp_ids.add(cid)

        failed_comps = [
            cid for cid, c in sim["sim_components"].items()
            if c["status"] == "FAILED"
        ]
        safe_paths = [
            pid for pid, p in sim["sim_paths"].items()
            if p.get("status") == "GUARANTEED"
        ]

        return {
            "affected_paths": violated_paths,
            "affected_paths_count": len(violated_paths),
            "affected_components": list(affected_comp_ids),
            "failed_components": failed_comps,
            "safe_paths": safe_paths,
            "safe_paths_count": len(safe_paths),
            "risk_level": (
                "CRITICAL" if len(violated_paths) >= 4 else
                "HIGH" if len(violated_paths) >= 2 else
                "MEDIUM" if len(violated_paths) >= 1 else "LOW"
            ),
        }

    @classmethod
    def get_simulation(cls, simulation_id: str) -> dict[str, Any] | None:
        """Retrieve a simulation state by ID."""
        _prune_old_simulations()
        sim = _simulations.get(simulation_id)
        if not sim:
            return None
        return {
            "simulation_id": sim["simulation_id"],
            "label": sim["label"],
            "status": sim["status"],
            "created_at": sim["created_at"],
            "run_at": sim["run_at"],
            "applied_scenarios": sim["applied_scenarios"],
            "summary": {
                "total_paths": len(sim["sim_paths"]),
                "sim_component_count": len(sim["sim_components"]),
            },
            "verification_results": sim.get("verification_results", {}),
            "blast_radius": sim.get("blast_radius"),
            "live_state_modified": False,
            # Side-by-side comparison
            "comparison": {
                "live_paths": {
                    pid: p["status"]
                    for pid, p in sim["live_snapshot"]["paths"].items()
                },
                "sim_paths": {
                    pid: p.get("status", "UNKNOWN")
                    for pid, p in sim["sim_paths"].items()
                },
            },
        }

    @classmethod
    def list_simulations(cls) -> list[dict[str, Any]]:
        _prune_old_simulations()
        return [
            {
                "simulation_id": s["simulation_id"],
                "label": s["label"],
                "status": s["status"],
                "created_at": s["created_at"],
                "scenarios_applied": len(s["applied_scenarios"]),
            }
            for s in _simulations.values()
        ]
