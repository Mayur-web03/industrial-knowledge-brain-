import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "knowledge_graph"))

from pdf_reader import process_folder
from entity_extractor import extract_entities
from graph_builder import KnowledgeGraphBuilder


def run_pipeline(industry_code: str):
    print("=" * 50)
    print(f"[{industry_code}] STEP 1: Reading PDFs from data/raw_docs/{industry_code}/")
    print("=" * 50)

    raw_docs_folder = f"../../data/raw_docs/{industry_code}"
    os.makedirs(raw_docs_folder, exist_ok=True)
    documents = process_folder(raw_docs_folder)

    if not documents:
        print("No PDFs found! Make sure files are in data/raw_docs/<industry_code>/")
        return

    print(f"Found {len(documents)} documents: {list(documents.keys())}\n")

    kg = KnowledgeGraphBuilder()
    all_entities = {}

    for doc_name, text in documents.items():
        print(f"\nProcessing: {doc_name}")
        try:
            entities = extract_entities(text)
            all_entities[doc_name] = entities
            kg.add_document_entities(doc_name, entities)
            time.sleep(2)
        except Exception as e:
            print(f"  ERROR processing {doc_name}: {e}")

    kg.print_summary()

    out_dir = f"../../data/processed/{industry_code}"
    os.makedirs(out_dir, exist_ok=True)

    kg.save_graph(f"{out_dir}/knowledge_graph.json")

    import json
    with open(f"{out_dir}/all_entities.json", "w") as f:
        json.dump(all_entities, f, indent=2)

    with open(f"{out_dir}/all_documents_text.json", "w") as f:
        json.dump(documents, f, indent=2)

    print(f"\n✅ Pipeline complete for {industry_code}!")
    return kg


if __name__ == "__main__":
    industry_code = sys.argv[1] if len(sys.argv) > 1 else "IND001"
    kg = run_pipeline(industry_code)