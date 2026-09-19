from __future__ import annotations

import hashlib
import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import faiss
import httpx
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

PROJECT_ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE_PATH = PROJECT_ROOT / "rag" / "knowledge_base" / "documents.json"
EMBEDDINGS_DIR = PROJECT_ROOT / "rag" / "embeddings"
INDEX_PATH = EMBEDDINGS_DIR / "knowledge.faiss"
METADATA_PATH = EMBEDDINGS_DIR / "metadata.json"
TOP_K = 3
MINIMUM_SIMILARITY = 0.35


def load_project_environment() -> None:
    for environment_path in (PROJECT_ROOT / ".env", PROJECT_ROOT / "client" / ".env"):
        if not environment_path.exists():
            continue
        for raw_line in environment_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            key, separator, value = line.partition("=")
            if separator and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key.strip()):
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_project_environment()
MODEL_NAME = os.getenv("RAG_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class Source(BaseModel):
    topic: str
    title: str
    content: str


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]


class RAGStore:
    def __init__(self) -> None:
        self.documents: list[dict[str, str]] = []
        self.index: faiss.Index | None = None
        self.model: SentenceTransformer | None = None

    def load(self) -> None:
        self.documents = json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))
        self.model = SentenceTransformer(MODEL_NAME)
        content_hash = hashlib.sha256(KNOWLEDGE_PATH.read_bytes()).hexdigest()
        EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)

        cached_metadata: dict[str, Any] = {}
        if METADATA_PATH.exists():
            cached_metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))

        if INDEX_PATH.exists() and cached_metadata.get("content_hash") == content_hash and cached_metadata.get("model") == MODEL_NAME:
            self.index = faiss.read_index(str(INDEX_PATH))
            return

        texts = [f"{document['topic']}\n{document['title']}\n{document['text']}" for document in self.documents]
        embeddings = self.model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
        matrix = np.asarray(embeddings, dtype="float32")
        self.index = faiss.IndexFlatIP(matrix.shape[1])
        self.index.add(matrix)
        faiss.write_index(self.index, str(INDEX_PATH))
        METADATA_PATH.write_text(
            json.dumps({"content_hash": content_hash, "model": MODEL_NAME}, indent=2),
            encoding="utf-8",
        )

    def retrieve(self, question: str) -> list[tuple[dict[str, str], float]]:
        if self.model is None or self.index is None:
            raise RuntimeError("RAG index is not loaded")
        query_embedding = self.model.encode([question], normalize_embeddings=True, convert_to_numpy=True)
        scores, positions = self.index.search(np.asarray(query_embedding, dtype="float32"), TOP_K)
        return [
            (self.documents[int(position)], float(score))
            for position, score in zip(positions[0], scores[0])
            if position >= 0 and float(score) >= MINIMUM_SIMILARITY
        ]


store = RAGStore()


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.load()
    yield


app = FastAPI(title="EcoAI Advisor RAG Service", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok" if store.index is not None else "starting"}


async def generate_grounded_answer(question: str, retrieved: list[tuple[dict[str, str], float]]) -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="The EcoAI Advisor is not configured.")

    context = "\n\n".join(
        f"SOURCE TOPIC: {document['topic']}\nSOURCE TITLE: {document['title']}\nCONTENT: {document['text']}"
        for document, _ in retrieved
    )
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    prompt = f"""You are EcoAI Advisor. Answer the user's question using only the retrieved knowledge context below for factual claims.

If the context does not contain enough information, clearly say that sufficient information was not found instead of inventing an answer. Do not fabricate regulations, recycler names, locations, legal requirements, or hazards. Give concise, practical advice. Mention the relevant source topics in the answer when useful. For Indian regulatory questions, state that current official government sources should be checked.

USER QUESTION:
{question}

RETRIEVED KNOWLEDGE CONTEXT:
{context}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            url,
            params={"key": api_key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="The AI provider is temporarily unavailable.")

    payload = response.json()
    answer = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(status_code=502, detail="The AI provider returned no answer.")
    return answer.strip()


@app.post("/query", response_model=AskResponse)
async def query(request: AskRequest) -> AskResponse:
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Please enter a question.")

    retrieved = store.retrieve(question)
    if not retrieved:
        return AskResponse(
            answer="I could not find sufficient information in the local e-waste knowledge base to answer that question.",
            sources=[],
        )

    answer = await generate_grounded_answer(question, retrieved)
    sources = [
        Source(topic=document["topic"], title=document["title"], content=document["text"])
        for document, _ in retrieved
    ]
    return AskResponse(answer=answer, sources=sources)
