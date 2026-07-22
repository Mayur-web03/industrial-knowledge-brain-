import io
import json
import os
import sys
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from pypdf import PdfReader
from docx import Document as DocxDocument

from database import Base, engine
from auth.auth_routes import router as auth_router
from auth.auth_utils import get_current_user

sys.path.append(os.path.dirname(__file__))
from chatbot.rag_pipeline import RAGPipeline
from vector_store.embedder import VectorStoreManager
from knowledge_graph.graph_queries import get_flagged_equipment, get_cascading_risk
from knowledge_graph.graph_builder import KnowledgeGraphBuilder
from ingestion.entity_extractor import extract_entities

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Industrial Nexus API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- Per-industry pipeline/vector-store cache (avoid re-loading the
#     embedding model on every request — expensive) ---
_pipeline_cache: dict[str, RAGPipeline] = {}
_vector_store_cache: dict[str, VectorStoreManager] = {}


def get_pipeline_for_industry(industry_code: str) -> RAGPipeline:
    if industry_code not in _pipeline_cache:
        _pipeline_cache[industry_code] = RAGPipeline(industry_code)
    return _pipeline_cache[industry_code]


def get_vector_store_for_industry(industry_code: str) -> VectorStoreManager:
    if industry_code not in _vector_store_cache:
        _vector_store_cache[industry_code] = VectorStoreManager(industry_code)
    return _vector_store_cache[industry_code]


def get_raw_docs_dir(industry_code: str) -> str:
    path = os.path.join(BASE_DIR, "..", "data", "raw_docs", industry_code)
    os.makedirs(path, exist_ok=True)
    return path


def get_processed_dir(industry_code: str) -> str:
    path = os.path.join(BASE_DIR, "..", "data", "processed", industry_code)
    os.makedirs(path, exist_ok=True)
    return path


def get_metadata_path(industry_code: str) -> str:
    return os.path.join(get_processed_dir(industry_code), "documents_metadata.json")


class QueryRequest(BaseModel):
    query: str
    n_results: int = 5
    graph_depth: int = 1


class QueryResponse(BaseModel):
    query: str
    answer: str
    sources: list[str]
    graph_entities: list[str]
    raw_context: str | None = None
    confidence: int = 0
    compliance_gaps: list[dict] = []


# ---------- Document metadata helpers (per-industry) ----------

def _bootstrap_metadata_from_raw_docs(industry_code: str, records: list[dict]) -> list[dict]:
    raw_docs_dir = get_raw_docs_dir(industry_code)
    known_filenames = {r["filename"] for r in records}

    changed = False
    for fname in sorted(os.listdir(raw_docs_dir)):
        if fname.startswith("."):
            continue
        if fname not in known_filenames:
            file_path = os.path.join(raw_docs_dir, fname)
            mtime = os.path.getmtime(file_path)
            records.append({
                "filename": fname,
                "upload_date": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
                "status": "indexed",
            })
            changed = True

    if changed:
        records.sort(key=lambda r: r["upload_date"], reverse=True)
        _save_metadata(industry_code, records)

    return records


def _load_metadata(industry_code: str) -> list[dict]:
    metadata_path = get_metadata_path(industry_code)
    if not os.path.exists(metadata_path):
        records = []
    else:
        try:
            with open(metadata_path, "r") as f:
                records = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            records = []

    return _bootstrap_metadata_from_raw_docs(industry_code, records)


def _save_metadata(industry_code: str, records: list[dict]):
    with open(get_metadata_path(industry_code), "w") as f:
        json.dump(records, f, indent=2)


def _register_document(industry_code: str, filename: str, status: str = "indexed"):
    records = _load_metadata(industry_code)
    records = [r for r in records if r["filename"] != filename]
    records.insert(0, {
        "filename": filename,
        "upload_date": datetime.now(timezone.utc).isoformat(),
        "status": status,
    })
    _save_metadata(industry_code, records)


def _remove_document_metadata(industry_code: str, filename: str):
    records = _load_metadata(industry_code)
    records = [r for r in records if r["filename"] != filename]
    _save_metadata(industry_code, records)


def extract_text(filename: str, content: bytes) -> str:
    ext = filename.lower().rsplit(".", 1)[-1]

    if ext == "txt":
        return content.decode("utf-8", errors="ignore")

    if ext == "pdf":
        reader = PdfReader(io.BytesIO(content))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)

    if ext == "docx":
        doc = DocxDocument(io.BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs)

    raise ValueError(f"Unsupported file type: .{ext}")


# ---------- Knowledge-graph build helper ----------

def _extend_knowledge_graph(industry_code: str, documents: dict):
    """
    Runs entity extraction on each newly-uploaded document and merges the
    result into the industry's persisted knowledge graph.
    """
    processed_dir = get_processed_dir(industry_code)
    graph_path = os.path.join(processed_dir, "knowledge_graph.json")
    entities_path = os.path.join(processed_dir, "all_entities.json")

    kg = KnowledgeGraphBuilder()
    if os.path.exists(graph_path):
        try:
            kg.load_graph(graph_path)
        except Exception as e:
            print(f"Could not load existing graph, starting fresh: {e}")

    all_entities = {}
    if os.path.exists(entities_path):
        try:
            with open(entities_path, "r") as f:
                all_entities = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            all_entities = {}

    for doc_name, text in documents.items():
        try:
            entities = extract_entities(text)
        except Exception as e:
            print(f"Entity extraction failed for {doc_name}: {e}")
            continue
        all_entities[doc_name] = entities
        kg.add_document_entities(doc_name, entities)

    kg.save_graph(graph_path)
    with open(entities_path, "w") as f:
        json.dump(all_entities, f, indent=2)


def _remove_document_from_knowledge_graph(industry_code: str, filename: str):
    """
    Document delete hone par uski entities aur graph-nodes bhi remove
    karta hai, taaki delete kiya hua doc knowledge graph me "ghost"
    entry ki tarah na reh jaye.
    """
    processed_dir = get_processed_dir(industry_code)
    graph_path = os.path.join(processed_dir, "knowledge_graph.json")
    entities_path = os.path.join(processed_dir, "all_entities.json")

    # entities file se hatao
    if os.path.exists(entities_path):
        try:
            with open(entities_path, "r") as f:
                all_entities = json.load(f)
            all_entities.pop(filename, None)
            with open(entities_path, "w") as f:
                json.dump(all_entities, f, indent=2)
        except (json.JSONDecodeError, FileNotFoundError):
            pass

    # graph se hatao (agar builder me support hai)
    if os.path.exists(graph_path):
        kg = KnowledgeGraphBuilder()
        try:
            kg.load_graph(graph_path)
            if hasattr(kg, "remove_document"):
                kg.remove_document(filename)
                kg.save_graph(graph_path)
            else:
                print(
                    f"KnowledgeGraphBuilder has no remove_document() — "
                    f"graph nodes from '{filename}' were left as-is. "
                    f"Run POST /graph/rebuild to fully clean up."
                )
        except Exception as e:
            print(f"Could not update graph after deleting {filename}: {e}")


# ---------- Public (no auth needed) ----------

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Industrial Nexus API is running"}

# ---------- Upload Endpoint (Hackathon Bypass: Public access with fixed industry) ----------

@app.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    industry_code = "IND001"
    
    raw_docs_dir = get_raw_docs_dir(industry_code)
    vector_store = get_vector_store_for_industry(industry_code)

    results = []
    documents = {}

    for file in files:
        content = await file.read()
        try:
            text = extract_text(file.filename, content)
            if not text.strip():
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "message": "No extractable text found",
                })
                continue

            safe_filename = os.path.basename(file.filename)
            dest_path = os.path.join(raw_docs_dir, safe_filename)
            with open(dest_path, "wb") as f:
                f.write(content)

            documents[file.filename] = text
            results.append({"filename": file.filename, "status": "indexed"})
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "message": str(e),
            })

    if documents:
        vector_store.add_documents(documents)
        for filename in documents:
            _register_document(industry_code, filename, status="indexed")

        # Build/update the knowledge graph for these newly uploaded docs.
        _extend_knowledge_graph(industry_code, documents)

    return {"results": results}

# ---------- Protected endpoints (industry-scoped) ----------

@app.post("/ask", response_model=QueryResponse)
def ask_question(request: QueryRequest, user: dict = Depends(get_current_user)):
    pipeline = get_pipeline_for_industry(user["industry_code"])
    result = pipeline.ask(
        query=request.query,
        n_results=request.n_results,
        graph_depth=request.graph_depth
    )
    return {
        "query": result["query"],
        "answer": result["answer"],
        "sources": result["sources"],
        "graph_entities": result["graph_entities"],
        "raw_context": result["raw_context"],
        "confidence": result["confidence"],
        "compliance_gaps": result["compliance_gaps"],
    }


@app.get("/flags")
def get_flags(user: dict = Depends(get_current_user)):
    return {"flags": get_flagged_equipment(user["industry_code"])}


@app.get("/graph")
def get_graph(user: dict = Depends(get_current_user)):
    graph_path = os.path.join(BASE_DIR, "..", "data", "processed", user["industry_code"], "knowledge_graph.json")
    if not os.path.exists(graph_path):
        return {"nodes": [], "edges": []}
    with open(graph_path, "r") as f:
        data = json.load(f)
    if "edges" not in data and "links" in data:
        data["edges"] = data["links"]
    return data


@app.get("/cascade/{node_id}")
def cascade_risk(node_id: str, depth: int = 2, user: dict = Depends(get_current_user)):
    return get_cascading_risk(node_id, user["industry_code"], max_depth=depth)


# Fixed: was hardcoded to "IND001" and had no auth dependency, so every
# logged-in user (regardless of industry) saw IND001's document list.
# Also removed the duplicate @app.get("/documents") decorator.
@app.get("/documents")
def list_documents(user: dict = Depends(get_current_user)):
    return {
        "documents": _load_metadata(user["industry_code"])
    }


@app.get("/files/{filename}")
def get_file(filename: str, user: dict = Depends(get_current_user)):
    raw_docs_dir = get_raw_docs_dir(user["industry_code"])
    file_path = os.path.join(raw_docs_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "File not found")
    return FileResponse(file_path)


@app.delete("/documents/{filename}")
def delete_document(filename: str, user: dict = Depends(get_current_user)):
    """
    Document ko poori tarah remove karta hai:
    1. Disk se raw PDF/DOCX/TXT file
    2. Chroma vector store se uske embeddings/chunks
    3. Knowledge graph se uski entities
    4. documents_metadata.json se entry
    """
    industry_code = user["industry_code"]
    safe_filename = os.path.basename(filename)

    raw_docs_dir = get_raw_docs_dir(industry_code)
    file_path = os.path.join(raw_docs_dir, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(404, "File not found")

    # 1. Disk se delete
    try:
        os.remove(file_path)
    except OSError as e:
        raise HTTPException(500, f"Could not delete file from disk: {e}")

    # 2. Vector store se delete
    vector_store = get_vector_store_for_industry(industry_code)
    if hasattr(vector_store, "delete_document"):
        try:
            vector_store.delete_document(safe_filename)
        except Exception as e:
            print(f"Vector store cleanup failed for {safe_filename}: {e}")
    else:
        print(
            f"VectorStoreManager has no delete_document() — embeddings for "
            f"'{safe_filename}' still exist in Chroma. Add a delete_document "
            f"method to embedder.py (e.g. collection.delete(where={{'source': filename}}))."
        )

    # 3. Knowledge graph se delete
    _remove_document_from_knowledge_graph(industry_code, safe_filename)

    # 4. Metadata se delete
    _remove_document_metadata(industry_code, safe_filename)

    return {"status": "deleted", "filename": safe_filename}


@app.post("/graph/rebuild")
def rebuild_graph(user: dict = Depends(get_current_user)):
    """
    One-time backfill: re-runs entity extraction over every document already
    on disk for this industry and rebuilds the graph from scratch.
    """
    industry_code = user["industry_code"]
    raw_docs_dir = get_raw_docs_dir(industry_code)

    documents = {}
    for fname in sorted(os.listdir(raw_docs_dir)):
        if fname.startswith("."):
            continue
        file_path = os.path.join(raw_docs_dir, fname)
        with open(file_path, "rb") as f:
            content = f.read()
        try:
            documents[fname] = extract_text(fname, content)
        except Exception as e:
            print(f"Skipping {fname} during rebuild: {e}")

    if not documents:
        return {"status": "no_documents", "count": 0}

    processed_dir = get_processed_dir(industry_code)
    graph_path = os.path.join(processed_dir, "knowledge_graph.json")
    entities_path = os.path.join(processed_dir, "all_entities.json")
    if os.path.exists(graph_path):
        os.remove(graph_path)
    if os.path.exists(entities_path):
        os.remove(entities_path)

    _extend_knowledge_graph(industry_code, documents)
    return {"status": "rebuilt", "count": len(documents)}


@app.post("/gmail/sync")
async def gmail_sync(user: dict = Depends(get_current_user)):
    # Yaha tera Gmail sync code chalega — abhi ye sirf stub hai,
    # actual Gmail OAuth + fetch logic implement karna baaki hai.
    return {
        "success": True,
        "message": "Gmail sync completed"
    }