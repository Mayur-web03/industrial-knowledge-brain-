import os
import json


def load_graph(industry_code: str):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    graph_path = os.path.join(base_dir, "..", "..", "data", "processed", industry_code, "knowledge_graph.json")
    if not os.path.exists(graph_path):
        return {"nodes": [], "edges": []}
    with open(graph_path, "r") as f:
        data = json.load(f)
    
    # networkx's node_link_data() saves edges under "links" by default,
    # not "edges" — normalize here so the rest of this file can just
    # always read graph["edges"] regardless of which key was on disk.
    if "edges" not in data and "links" in data:
        data["edges"] = data["links"]
    return data


def _build_adjacency(graph):
    adjacency = {}
    for edge in graph.get("edges", []):
        src, tgt = edge["source"], edge["target"]
        meta = {"relation": edge.get("relation"), "source_doc": edge.get("source_doc")}
        adjacency.setdefault(src, []).append((tgt, meta))
        adjacency.setdefault(tgt, []).append((src, meta))
    return adjacency


# ---------------------------------------------------------------------
# FLAGGED EQUIPMENT
# ---------------------------------------------------------------------

def get_flagged_equipment(industry_code: str):
    graph = load_graph(industry_code)
    nodes = {n["id"]: n for n in graph.get("nodes", [])}

    # Using our structured _build_adjacency function for clean lookup
    full_adjacency = _build_adjacency(graph)
    
    # Extract clean pure-neighbor-list adjacency for hop calculation
    adjacency = {node: [neighbor for neighbor, _ in neighbors] for node, neighbors in full_adjacency.items()}

    incident_ids = [nid for nid in nodes if nid.startswith("INC-")]
    equipment_ids = [nid for nid, n in nodes.items() if n.get("type") == "equipment"]

    flags = []
    for equip in equipment_ids:
        for incident in incident_ids:
            shared = _shared_context_within_hops(equip, incident, adjacency, max_hops=2)
            if shared:
                flags.append({
                    "equipment": equip,
                    "related_incident": incident,
                    "shared_context": shared,
                })

    return flags


def _shared_context_within_hops(node_a, node_b, adjacency, max_hops=2):
    if node_a not in adjacency or node_b not in adjacency:
        return None

    frontier_a = set(adjacency.get(node_a, []))
    frontier_b = set(adjacency.get(node_b, []))

    shared_1hop = frontier_a & frontier_b
    if shared_1hop:
        return list(shared_1hop)

    if max_hops >= 2:
        frontier_a2 = set()
        for n in frontier_a:
            frontier_a2.update(adjacency.get(n, []))
        shared_2hop = frontier_a2 & frontier_b
        if shared_2hop:
            return list(shared_2hop)

    return None


# ---------------------------------------------------------------------
# CASCADING RISK SIMULATOR
# ---------------------------------------------------------------------

def get_cascading_risk(node_id: str, industry_code: str, max_depth: int = 2) -> dict:
    graph = load_graph(industry_code)
    nodes = {n["id"]: n for n in graph.get("nodes", [])}

    if node_id not in nodes:
        return {"root": node_id, "found": False, "levels": [], "explanation": []}

    adjacency = _build_adjacency(graph)

    visited = {node_id}
    levels = []
    explanation = []
    current_level = [node_id]

    for depth in range(1, max_depth + 1):
        next_level = []
        for node in current_level:
            for neighbor, meta in adjacency.get(node, []):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                next_level.append(neighbor)
                explanation.append({
                    "from": node,
                    "to": neighbor,
                    "to_type": nodes.get(neighbor, {}).get("type", "unknown"),
                    "depth": depth,
                    "reason": _describe_relation(node, neighbor, meta),
                })
        if not next_level:
            break
        levels.append(next_level)
        current_level = next_level

    return {
        "root": node_id,
        "root_type": nodes.get(node_id, {}).get("type"),
        "found": True,
        "levels": levels,
        "explanation": explanation,
        "total_affected": len(visited) - 1,
    }


def _describe_relation(source: str, target: str, meta: dict) -> str:
    relation = meta.get("relation")
    source_doc = meta.get("source_doc")

    if relation == "co_occurs_in_document" and source_doc:
        return f"shares maintenance history with {source} (co-mentioned in {source_doc})"
    if relation == "mentions":
        return f"is mentioned in the same record as {source}"
    if relation == "references":
        return f"is referenced by {source}"
    return f"is directly connected to {source}"


# ---------------------------------------------------------------------
# COMPLIANCE GAP CHECK
# ---------------------------------------------------------------------

MAINTENANCE_DOC_KEYWORDS = ("maintenance", "inspection", "service", "audit", "checklist")


def _looks_like_maintenance_doc(doc_id: str) -> bool:
    lowered = doc_id.lower()
    return any(kw in lowered for kw in MAINTENANCE_DOC_KEYWORDS)


def _reachable_of_type(start_id, target_type, adjacency, nodes, max_hops=2):
    visited = {start_id}
    frontier = [start_id]
    found = set()

    for _ in range(max_hops):
        next_frontier = []
        for node in frontier:
            for neighbor, _meta in adjacency.get(node, []):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                next_frontier.append(neighbor)
                if nodes.get(neighbor, {}).get("type") == target_type:
                    found.add(neighbor)
        frontier = next_frontier

    return found


def get_compliance_gaps(industry_code: str) -> list:
    graph = load_graph(industry_code)
    nodes = {n["id"]: n for n in graph.get("nodes", [])}
    adjacency = _build_adjacency(graph)

    procedures = [nid for nid, n in nodes.items() if n.get("type") == "procedure"]

    gaps = []
    seen_pairs = set()

    for proc in procedures:
        connected_equipment = _reachable_of_type(proc, "equipment", adjacency, nodes, max_hops=2)

        for eq in connected_equipment:
            pair_key = (proc, eq)
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            direct_docs = [
                neighbor for neighbor, _meta in adjacency.get(eq, [])
                if nodes.get(neighbor, {}).get("type") == "document"
            ]
            maintenance_docs = [d for d in direct_docs if _looks_like_maintenance_doc(d)]

            if not maintenance_docs:
                gaps.append({
                    "procedure": proc,
                    "equipment": eq,
                    "requirement": f"{eq} is subject to {proc} based on shared document references.",
                    "gap": (
                        f"No maintenance or inspection record was found for {eq} in the "
                        f"knowledge base, despite it being linked to {proc}. This may indicate "
                        f"missing documentation or an overdue inspection."
                    ),
                })

    return gaps


def get_compliance_gaps_for_entities(entity_ids: set, industry_code: str) -> list:
    all_gaps = get_compliance_gaps(industry_code)
    return [
        g for g in all_gaps
        if g["procedure"] in entity_ids or g["equipment"] in entity_ids
    ]


if __name__ == "__main__":
    import sys
    industry_code = sys.argv[1] if len(sys.argv) > 1 else "IND001"

    flags = get_flagged_equipment(industry_code)
    print(json.dumps(flags, indent=2))

    cascade = get_cascading_risk("Boiler-3", industry_code, max_depth=2)
    print(json.dumps(cascade, indent=2))