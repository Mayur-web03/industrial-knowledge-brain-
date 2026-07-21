import os
import json
import chromadb
from chromadb.utils import embedding_functions

class VectorStoreManager:
    def __init__(self, industry_code: str, persist_directory=None):
        self.industry_code = industry_code

        if persist_directory is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            persist_directory = os.path.join(
                base_dir, "..", "..", "data", "processed", industry_code, "chroma_db"
            )

        os.makedirs(persist_directory, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_directory)

        # Using a free, local sentence-transformer model for embeddings
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )

        # Collection name scoped per-industry so no two industries' vectors
        # can ever mix, even within the same Chroma persist directory.
        self.collection = self.client.get_or_create_collection(
            name=f"industrial_documents_{industry_code}",
            embedding_function=self.embedding_fn,
            metadata={"hnsw:space": "cosine"}
        )

    def add_documents(self, documents: dict):
        """
        documents: dict of {filename: text_content}
        Adds each document to the vector store, chunked if necessary.
        """
        ids = []
        texts = []
        metadatas = []

        for doc_name, text in documents.items():
            chunks = [c.strip() for c in text.split("\n\n") if c.strip()]

            for i, chunk in enumerate(chunks):
                chunk_id = f"{doc_name}_chunk{i}"
                ids.append(chunk_id)
                texts.append(chunk)
                metadatas.append({"source_document": doc_name, "chunk_index": i})

        if texts:
            self.collection.add(
                ids=ids,
                documents=texts,
                metadatas=metadatas
            )
            print(f"[{self.industry_code}] Added {len(texts)} chunks from {len(documents)} documents to vector store.")

    def search(self, query: str, n_results: int = 3) -> list:
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )

        output = []
        for i in range(len(results["documents"][0])):
            output.append({
                "text": results["documents"][0][i],
                "source": results["metadatas"][0][i]["source_document"],
                "distance": results["distances"][0][i]
            })
        return output


if __name__ == "__main__":
    import sys
    industry_code = sys.argv[1] if len(sys.argv) > 1 else "IND001"

    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_path = os.path.join(base_dir, "..", "..", "data", "processed", industry_code, "all_documents_text.json")

    with open(docs_path, "r") as f:
        documents = json.load(f)

    vs = VectorStoreManager(industry_code)
    vs.add_documents(documents)

    print("\n--- Test query: 'vibration issues in feed pumps' ---")
    results = vs.search("vibration issues in feed pumps", n_results=3)
    for r in results:
        print(f"\nSource: {r['source']} (distance: {r['distance']:.4f})")
        print(f"Text: {r['text'][:200]}...")