import os
import re
import json
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from vector_store.embedder import VectorStoreManager


def _normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _extract_similarity(r: dict) -> float:
    if "score" in r and r["score"] is not None:
        sim = float(r["score"])
    elif "similarity" in r and r["similarity"] is not None:
        sim = float(r["similarity"])
    elif "distance" in r and r["distance"] is not None:
        sim = 1 - float(r["distance"])
    else:
        sim = 0.55
    return max(0.0, min(sim, 1.0))


class HybridRetriever:
    def __init__(self, industry_code: str, graph_path=None):
        self.industry_code = industry_code
        self.vs = VectorStoreManager(industry_code)

        if graph_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            graph_path = os.path.join(base_dir, "..", "..", "data", "processed", industry_code, "knowledge_graph.json")

        if os.path.exists(graph_path):
            with open(graph_path, "r") as f:
                self.graph_data = json.load(f)
        else:
            self.graph_data = {"nodes": [], "edges": []}

        self.nodes = {n["id"]: n for n in self.graph_data.get("nodes", [])}
        self.adjacency = {}

        for edge in self.graph_data.get("edges", []):
            src, tgt = edge["source"], edge["target"]
            self.adjacency.setdefault(src, []).append({"target": tgt, "relation": edge.get("relation", "related_to")})
            self.adjacency.setdefault(tgt, []).append({"target": src, "relation": edge.get("relation", "related_to")})

    def find_matching_nodes(self, text: str):
        matched = []
        text_lower = text.lower()
        for node_id, node in self.nodes.items():
            label = str(node.get("label", node.get("name", node_id))).lower()
            if label and label in text_lower:
                matched.append(node_id)
        return matched

    def expand_via_graph(self, node_ids: list, depth: int = 1):
        expanded = set(node_ids)
        frontier = set(node_ids)

        for _ in range(depth):
            next_frontier = set()
            for nid in frontier:
                for edge in self.adjacency.get(nid, []):
                    if edge["target"] not in expanded:
                        next_frontier.add(edge["target"])
                        expanded.add(edge["target"])
            frontier = next_frontier

        return expanded

    def _filter_relevant(self, vector_results: list) -> list:
        SANITY_FLOOR = 0.15

        scored = [(r, _extract_similarity(r)) for r in vector_results]
        scored = [(r, sim) for r, sim in scored if sim >= SANITY_FLOOR]

        best_per_source = {}
        for r, sim in scored:
            source = r.get("source")
            if source not in best_per_source or sim > best_per_source[source][1]:
                best_per_source[source] = (r, sim)

        deduped = sorted(best_per_source.values(), key=lambda x: x[1], reverse=True)
        return [r for r, _ in deduped]

    def retrieve(self, query: str, n_results: int = 3, graph_depth: int = 1):
        raw_fetch_count = max(n_results * 4, 10)
        raw_vector_results = self.vs.search(query, n_results=raw_fetch_count)

        deduped = self._filter_relevant(raw_vector_results)
        vector_results = deduped[:n_results]

        all_matched_nodes = set()
        for r in vector_results:
            matched = self.find_matching_nodes(r["text"])
            all_matched_nodes.update(matched)

        expanded_nodes = self.expand_via_graph(list(all_matched_nodes), depth=graph_depth)

        graph_context = []
        for nid in expanded_nodes:
            node = self.nodes.get(nid, {})
            graph_context.append({
                "id": nid,
                "label": node.get("label", node.get("name", nid)),
                "type": node.get("type", "unknown")
            })

        combined_text = self._build_combined_context(vector_results, graph_context)
        confidence = self._compute_confidence(vector_results, graph_context, query)

        return {
            "vector_results": vector_results,
            "graph_context": graph_context,
            "combined_text": combined_text,
            "confidence": confidence,
        }

    def _query_names_known_entity(self, query: str, graph_context: list) -> bool:
        q_norm = _normalize(query)
        for g in graph_context:
            label_norm = _normalize(str(g.get("label", "")))
            if len(label_norm) >= 4 and label_norm in q_norm:
                return True
        return False

    def _compute_confidence(self, vector_results: list, graph_context: list, query: str = "") -> int:
        if not vector_results:
            return 0
        similarities = [_extract_similarity(r) for r in vector_results]
        
        weights = [3, 2] + [1] * max(0, len(similarities) - 2)
        weighted_sum = sum(s * w for s, w in zip(similarities, weights))
        weighted_avg = weighted_sum / sum(weights[:len(similarities)])
        
        # Recalibrated for MiniLM's real-world similarity range — a 0.5 similarity
        # from this model is already a strong match, not a mediocre one.
        LOW, HIGH = 0.20, 0.55
        stretched = (weighted_avg - LOW) / (HIGH - LOW)
        stretched = max(0.0, min(stretched, 1.0))
        base = 20 + stretched * 60
        
        graph_context_count = len(graph_context)
        corroboration_boost = min(graph_context_count * 1.0, 10)
        
        entity_bonus = 10 if self._query_names_known_entity(query, graph_context) else 0
        
        retrieval_confidence = min(base + corroboration_boost + entity_bonus, 95)
        return round(retrieval_confidence)

    def _build_combined_context(self, vector_results, graph_context):
        parts = ["=== Relevant Document Excerpts ===\n"]
        for i, r in enumerate(vector_results, 1):
            parts.append(f"[Source {i}: {r['source']}]\n{r['text']}\n")

        if graph_context:
            parts.append("\n=== Related Entities (Knowledge Graph) ===\n")
            for g in graph_context:
                parts.append(f"- {g['label']} ({g['type']})")

        return "\n".join(parts)


if __name__ == "__main__":
    import sys
    industry_code = sys.argv[1] if len(sys.argv) > 1 else "IND001"
    retriever = HybridRetriever(industry_code)

    query = "vibration issues in feed pumps"
    result = retriever.retrieve(query, n_results=5, graph_depth=1)
    print(result["combined_text"])
    print(f"\nConfidence: {result['confidence']}")