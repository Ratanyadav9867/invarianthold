from typing import List, Dict, Any, Optional, Tuple
import networkx as nx
from sqlalchemy.orm import Session
from app.models.component import Component, TopologyNode, TopologyEdge
from app.models.invariant import TrafficPath

class GraphEngine:
    def __init__(self, db: Optional[Session] = None):
        self.graph = nx.DiGraph()
        self.node_metadata: Dict[str, Dict[str, Any]] = {}
        self.edge_metadata: Dict[str, Dict[str, Any]] = {}
        self.component_to_node: Dict[str, str] = {}
        self.node_to_component: Dict[str, str] = {}
        if db:
            self.load_from_db(db)

    def load_from_db(self, db: Session):
        """Build the NetworkX graph from database topology nodes, edges, and components."""
        self.graph.clear()
        self.node_metadata.clear()
        self.edge_metadata.clear()
        self.component_to_node.clear()
        self.node_to_component.clear()

        # Load Components for mapping
        components = {c.id: c for c in db.query(Component).all()}

        # Load Nodes
        nodes = db.query(TopologyNode).all()
        for node in nodes:
            comp = components.get(node.component_id) if node.component_id else None
            meta = {
                "id": node.id,
                "label": node.label,
                "node_type": node.node_type,
                "zone": node.zone,
                "component_id": node.component_id,
                "component_type": comp.type if comp else None,
                "status": comp.status if comp else "HEALTHY",
                "health_score": comp.health_score if comp else 1.0,
                "pos_x": node.pos_x,
                "pos_y": node.pos_y
            }
            self.graph.add_node(node.id, **meta)
            self.node_metadata[node.id] = meta

            if node.component_id:
                self.component_to_node[node.component_id] = node.id
                self.node_to_component[node.id] = node.component_id

        # Load Edges
        edges = db.query(TopologyEdge).all()
        for edge in edges:
            edge_meta = {
                "id": edge.id,
                "latency_ms": edge.latency_ms,
                "bandwidth_mbps": edge.bandwidth_mbps,
                "status": edge.status,
                "packet_loss_pct": edge.packet_loss_pct
            }
            self.graph.add_edge(edge.source_node, edge.target_node, **edge_meta)
            self.edge_metadata[f"{edge.source_node}->{edge.target_node}"] = edge_meta

    def get_path_components(self, db: Session, hops: List[str]) -> List[Component]:
        """Return the list of Component objects present along the specified path hops."""
        component_ids = []
        for node_id in hops:
            comp_id = self.node_to_component.get(node_id)
            if comp_id:
                component_ids.append(comp_id)

        if not component_ids:
            return []

        # Maintain order of occurrence along the path
        comps = {c.id: c for c in db.query(Component).filter(Component.id.in_(component_ids)).all()}
        return [comps[cid] for cid in component_ids if cid in comps]

    def get_path_control_types(self, db: Session, hops: List[str]) -> List[str]:
        """Return distinct control types present along the path, ordered by traversal."""
        components = self.get_path_components(db, hops)
        seen = set()
        controls = []
        for c in components:
            if c.type not in seen:
                seen.add(c.type)
                controls.append(c.type)
        return controls

    def build_dependency_map(self, db: Session) -> Dict[str, List[str]]:
        """
        Map each component ID to all path IDs that transit through it.
        Example: {'ENC-01': ['PATH-PCI-TX-01', 'PATH-PCI-TX-02', 'PATH-PCI-RECURRING']}
        """
        dependency_map: Dict[str, List[str]] = {}
        all_components = db.query(Component).all()
        for comp in all_components:
            dependency_map[comp.id] = []

        paths = db.query(TrafficPath).filter(TrafficPath.is_active == True).all()
        for path in paths:
            hops = path.current_hops or []
            for node_id in hops:
                comp_id = self.node_to_component.get(node_id)
                if comp_id and comp_id in dependency_map:
                    if path.id not in dependency_map[comp_id]:
                        dependency_map[comp_id].append(path.id)

        return dependency_map

    def find_all_simple_paths(self, source: str, destination: str, cutoff: int = 8) -> List[List[str]]:
        """Find all acyclic simple paths between source and destination within cutoff hops."""
        if not self.graph.has_node(source) or not self.graph.has_node(destination):
            return []
        try:
            return list(nx.all_simple_paths(self.graph, source=source, target=destination, cutoff=cutoff))
        except nx.NetworkXNoPath:
            return []

    def find_candidate_alternate_paths(self, db: Session, path: TrafficPath, cutoff: int = 8) -> List[List[str]]:
        """
        Discover candidate alternate paths for a given TrafficPath.
        Excludes the currently active hops and prioritizes paths using available components.
        """
        all_paths = self.find_all_simple_paths(path.source_node, path.destination_node, cutoff=cutoff)
        current = tuple(path.current_hops or [])

        # Filter out identical path
        candidates = [p for p in all_paths if tuple(p) != current]

        # If path has predefined alternate_hops in DB, put it first if it exists
        if path.alternate_hops and list(path.alternate_hops) in candidates:
            candidates.remove(list(path.alternate_hops))
            candidates.insert(0, list(path.alternate_hops))

        return candidates

    def get_topology_snapshot(self) -> Dict[str, Any]:
        """Export serialized graph data for React Flow visualization."""
        nodes_export = []
        for node_id, data in self.graph.nodes(data=True):
            nodes_export.append({
                "id": node_id,
                "label": data.get("label", node_id),
                "node_type": data.get("node_type", "SERVER"),
                "zone": data.get("zone", "INTERNAL"),
                "component_id": data.get("component_id"),
                "component_type": data.get("component_type"),
                "status": data.get("status", "HEALTHY"),
                "health_score": data.get("health_score", 1.0),
                "position": {"x": data.get("pos_x", 0), "y": data.get("pos_y", 0)}
            })

        edges_export = []
        for u, v, data in self.graph.edges(data=True):
            edges_export.append({
                "id": f"{u}->{v}",
                "source": u,
                "target": v,
                "latency_ms": data.get("latency_ms", 1.0),
                "bandwidth_mbps": data.get("bandwidth_mbps", 1000.0),
                "status": data.get("status", "UP"),
                "packet_loss_pct": data.get("packet_loss_pct", 0.0)
            })

        return {
            "nodes": nodes_export,
            "edges": edges_export,
            "node_count": len(nodes_export),
            "edge_count": len(edges_export)
        }
