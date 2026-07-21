import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from vector_store.retriever import HybridRetriever
from chatbot.llm_client import generate_answer, assess_confidence
from knowledge_graph.graph_queries import get_compliance_gaps_for_entities


class RAGPipeline:
    def __init__(self, industry_code: str):
        self.industry_code = industry_code
        self.retriever = HybridRetriever(industry_code)

    def ask(self, query: str, n_results: int = 5, graph_depth: int = 1) -> dict:
        retrieval = self.retriever.retrieve(query, n_results=n_results, graph_depth=graph_depth)
        answer = generate_answer(query, retrieval["combined_text"])

        # LLM-based grounding check — this is the signal that actually
        # reflects whether THIS answer is well supported, not just whether
        # retrieval found "similar-ish" text.
        grounding = assess_confidence(query, retrieval["combined_text"], answer)
        
        retrieval_confidence = retrieval["confidence"]
        llm_confidence = grounding["confidence"]
        
        # LLM grounding score weighted higher — it's judging the actual
        # answer, retrieval score is just a supporting signal.
        final_confidence = round(0.35 * retrieval_confidence + 0.65 * llm_confidence)

        raw_sources = [r["source"] for r in retrieval["vector_results"]]
        clean_sources = []
        seen = set()
        for s in raw_sources:
            if not s:
                continue
            filename = os.path.basename(s.strip())
            if filename not in seen:
                seen.add(filename)
                clean_sources.append(filename)

        entity_ids = {g["id"] for g in retrieval["graph_context"]}
        entity_ids.update(self.retriever.find_matching_nodes(query))
        compliance_gaps = get_compliance_gaps_for_entities(entity_ids, self.industry_code)

        return {
            "query": query,
            "answer": answer,
            "sources": clean_sources,
            "graph_entities": [g["label"] for g in retrieval["graph_context"]],
            "raw_context": retrieval["combined_text"],
            "confidence": final_confidence,
            "confidence_reason": grounding["reason"],
            "compliance_gaps": compliance_gaps,
        }


if __name__ == "__main__":
    import sys
    industry_code = sys.argv[1] if len(sys.argv) > 1 else "IND001"
    pipeline = RAGPipeline(industry_code)

    result = pipeline.ask("is pump 104 connected to the boiler-3 incident")
    print(result["answer"])
    print(f"Confidence: {result['confidence']}%")
    if "confidence_reason" in result:
        print(f"Reason: {result['confidence_reason']}")