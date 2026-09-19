# EcoAI Advisor RAG Service

This service implements the EcoAI Advisor pipeline:

`question -> Sentence Transformers embedding -> FAISS similarity search -> retrieved knowledge -> Gemini -> answer and sources`

## Setup

Use a Python version with compatible wheels for `faiss-cpu` and `sentence-transformers` (Python 3.11 or 3.12 is recommended if Python 3.14 wheels are unavailable).

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r rag\requirements.txt
py -m uvicorn rag.service.app:app --host 127.0.0.1 --port 8000
```

The first startup downloads the embedding model and creates a cached FAISS index under `rag/embeddings/`. Later requests reuse that index. Add or edit documents in `rag/knowledge_base/documents.json`; the content hash causes the index to rebuild on the next service startup.

The service reads `GEMINI_API_KEY` from the project root `.env`. For compatibility with the existing project configuration, it also accepts `VITE_GEMINI_API_KEY` from `client/.env`. The key is never returned to the frontend.

The Express application proxies authenticated user requests through `POST /api/ecoai-advisor` to this service. Start the Node application separately with `npm start`.
