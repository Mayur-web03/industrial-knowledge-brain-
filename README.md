# 🏭 Industrial Nexus

**AI-Powered Industrial Knowledge Intelligence Platform**

Industrial Nexus unifies fragmented plant documentation — engineering drawings, maintenance records, safety procedures, inspection reports, and compliance files — into a single, continuously updated knowledge graph. Five connected AI agents deliver conversational Q&A, predictive maintenance and root-cause analysis, continuous regulatory compliance, and organisation-wide lessons-learned intelligence.

🔗 **Live Demo:** [industrial-knowledge-brain.vercel.app](https://industrial-knowledge-brain.vercel.app/)

---

## 👥 Team — Pair Programmers

| Member | Role |
|---|---|
| Mayur Choudhary | Full Stack / AI Engineering |
| Shailesh Madane | Full Stack / AI Engineering |

---

## 📌 Overview

The platform combines **RAG (Retrieval-Augmented Generation)**, **knowledge graphs**, **computer vision**, and **low-latency LLM inference** to:

- Cut information-retrieval time
- Reduce unplanned downtime
- Keep plants continuously audit-ready
- Preserve institutional knowledge as experienced engineers retire

### 🎯 Objectives

- Unify heterogeneous, siloed industrial documents into one queryable knowledge graph
- Give every employee a sourced, cited answer in seconds, on any device
- Predict equipment failures and accelerate root-cause analysis using historical patterns
- Keep plants continuously audit-ready against regulatory and internal quality standards
- Capture institutional knowledge before it is lost to workforce attrition

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Universal Document Upload** | PDFs, DOCX, scans, Excel, SOPs and P&IDs processed automatically |
| **Smart Email Auto-Sync** | Monitors mailboxes and ingests attachments without manual uploads |
| **AI Knowledge Copilot** | Natural-language Q&A with cited, confidence-scored responses |
| **Knowledge Graph Explorer** | Visually connects equipment, SOPs, manuals, incidents & records |
| **Hybrid Search** | Vector search + knowledge-graph retrieval for higher accuracy |
| **Predictive Maintenance** | Flags likely failures from historical patterns |
| **Compliance Monitoring** | Automatically detects audit and regulatory gaps |
| **Lessons Learned Engine** | Surfaces recommendations from historical incidents |
| **Dashboard & Analytics** | Document stats, graph growth and platform usage |
| **Role-Based Access Control** | Secure access for engineers, managers and auditors |

### 📧 Smart Email Auto-Synchronization

Industrial Nexus continuously monitors configured mailboxes (IMAP/SMTP), auto-downloads attachments, classifies them, extracts metadata, updates the knowledge graph, and makes the content immediately searchable — so the system never depends on manual uploads alone.

```
Inbox → New Attachment → Auto Download → OCR → Metadata Extraction → KG Update → Searchable
```

---

## 🧩 Solution Modules

Five modules share one underlying knowledge graph, so intelligence gathered by one module strengthens every other.

| # | Module | Core Function |
|---|---|---|
| 1 | Ingestion & Knowledge Graph Agent | Converts every document type into structured, connected knowledge |
| 2 | Expert Knowledge Copilot | Mobile-first conversational Q&A with citations and confidence scores |
| 3 | Maintenance Intelligence & RCA Agent | Predicts failures and accelerates root-cause analysis |
| 4 | Quality & Regulatory Compliance Intelligence | Continuously checks operations against regulatory requirements |
| 5 | Lessons Learned & Failure Intelligence Engine | Mines incident history to warn teams before failures recur |

```
Ingestion → Knowledge Graph → AI Agents → Applications → Business Intelligence
```

---

## 🏗️ System Architecture

Layered, microservice-oriented design: documents pass through OCR/NLP extraction → entities and relationships populate the **Neo4j** knowledge graph → chunk embeddings are stored in **ChromaDB** → **LangChain/LangGraph** orchestrate the Planner, Retriever, RCA, Compliance, Lessons-Learned and Validator agents → **Groq's Llama 3.3 70B** generates grounded, low-latency responses → applications (Copilot, dashboards, alerts) consume agent output through a common API layer.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js |
| Backend | FastAPI |
| AI Orchestration | LangChain + LangGraph (Planner / Retriever / Validator) |
| LLM Inference | Groq API — Llama 3.3 70B |
| OCR | Tesseract |
| Embeddings | BGE-Large |
| Vector Database | ChromaDB |
| Graph Database | Neo4j |
| Relational Database | PostgreSQL |
| Object Storage | AWS S3 |
| Deployment | Docker → Kubernetes |

---

## ⚙️ AI Processing Pipelines

**Document Ingestion Pipeline**
```
Upload → OCR + Cleaning → Chunking → Embedding (BGE) → Entity Extraction → Knowledge Graph
```

**Query / Agent Pipeline**
```
User Query → Intent + Planner → Retriever Agent → Graph + Vector Retrieval → Context Builder → Groq LLM → Validator → Cited Answer
```

---

## 🔌 API Reference

| Endpoint | Purpose |
|---|---|
| `POST /upload` | Upload a document for ingestion |
| `POST /query` | Ask a natural-language question |
| `GET /graph` | Retrieve knowledge graph data |
| `GET /audit` | Retrieve audit logs and evidence |
| `GET /maintenance/recommendations` | Fetch predictive maintenance flags |
| `GET /compliance/gaps` | Fetch current compliance gap alerts |

---

## 🗄️ Core Data Entities

`Users` · `Documents` · `Chunks` · `Embeddings (ChromaDB)` · `Knowledge Graph nodes/relationships (Neo4j)` · `Queries` · `Feedback` · `Audit Logs`

---

## 🚀 Deployment & Scalability

```
Browser → API Gateway → FastAPI → Orchestrator → Groq / Neo4j / ChromaDB → PostgreSQL / S3
```

```
Single Plant → Multi-Plant → Multi-Tenant → Docker → Kubernetes → Cloud
```

---

## 🤔 Why These Technologies

| Choice | Rationale |
|---|---|
| **Knowledge Graph** | Preserves relationships (asset ↔ SOP ↔ incident) for multi-hop, explainable reasoning that vector search alone cannot provide |
| **RAG** | Grounds the LLM in the plant's own documents at query time, so every answer carries a verifiable citation |
| **Groq (Llama 3.3 70B)** | LPU-based inference keeps Copilot response time under the 2-second target even with graph + vector retrieval |
| **Neo4j** | Natively models many-to-many asset/SOP/incident relationships for fast multi-hop traversal |
| **ChromaDB** | Lightweight embeddable vector store for semantic similarity, complementing graph structure |

---

## 🔐 Security & Data Design

- RBAC + JWT/OAuth · Encrypted storage · Full audit logging
- Document versioning with automatic knowledge-graph updates
- Duplicate detection via hashing + semantic similarity
- Smart metadata extraction — Equipment ID, Asset, Vendor, Department, Date, SOP/Revision
- Explainable AI — every answer includes source, confidence score, retrieved passages and graph path

## 🌟 Why Industrial Nexus Is Different

- **Hybrid Retrieval** — vector search + knowledge-graph traversal
- **Agentic AI** — Planner, Retriever, RCA, Compliance and Lessons-Learned agents working together
- **Real-time updates** — graph and vector index update continuously, including via email auto-sync

---

## 📊 Performance Targets

| Metric | Target |
|---|---|
| OCR Accuracy | > 95% |
| Query Response Time | < 2 sec |
| Citation Accuracy | > 98% |
| Graph Link Accuracy | > 92% |
| Retrieval Precision | > 90% |
| Document Upload Processing | < 10 sec |

## 📈 Expected Business Impact

| KPI | Improvement |
|---|---|
| Information Search Time | 35 min → 20 sec |
| Root-Cause Analysis Time | 3 hrs → 15 min |
| Compliance Preparation | 2 days → 20 min |

---

## 🖥️ User Interface

- **Dashboard** — recent uploads, document statistics, graph growth
- **AI Chat / Copilot** — conversational Q&A with citations
- **Knowledge Graph Explorer** — interactive asset relationship view
- **Document Upload** — drag-and-drop and email-synced ingestion
- **Maintenance & Compliance Dashboards** — predictions, RCA evidence, gap alerts
- **Recent Queries** — query history and feedback

---

## 🔭 Future Scope

- IoT sensor integration for real-time condition monitoring; SAP/Maximo work-order sync
- Digital Twin overlay on the knowledge graph; voice assistant for hands-free field use
- MCP integration for standardized tool/agent connectivity; Edge AI for on-site inference
- Multi-language support for global plant operations

---

## 📝 Conclusion

Industrial Nexus combines OCR, knowledge graphs, Retrieval-Augmented Generation, and Groq-powered low-latency inference to transform fragmented industrial documentation into a unified operational intelligence system — reducing retrieval time, supporting predictive maintenance, strengthening compliance, and preserving institutional knowledge while remaining scalable for Industry 4.0 deployments.

---

## 📄 License

This project was built for hackathon submission by **Team Pair Programmers**.

## 🙌 Contributors

- **Mayur Choudhary**
- **Shailesh Madane**
