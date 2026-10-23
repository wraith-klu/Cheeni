"""
Cheeni Desktop Agent -- Notes Memory Indexer (V20)
Index local notes/documents folders into semantic vector search.
Supports .md, .txt, .pdf files.

CLI-style usage (via API):
    POST /api/memory/index    body: {"path": "C:/Users/.../notes"}   -> index a folder
    POST /api/memory/search   body: {"query": "machine learning"}    -> semantic search
    GET  /api/memory/sources                                          -> list indexed sources
    DELETE /api/memory/source body: {"path": "..."}                  -> remove an index

Architecture:
    - Chunks documents into ~500 char paragraphs
    - Embeds with sentence-transformers (same model as PersonalMemory)
    - Stores in SQLite (cheeni-agent/data/notes_index.db)
    - Semantic search returns top-k matching chunks with source path + snippet
"""

import os
import json
import time
import sqlite3
import threading
from pathlib import Path
from typing import Generator
from utils.logging import logger

# ── Optional deps ──────────────────────────────────────────────────────────────
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    EMBEDDER_OK = True
except ImportError:
    EMBEDDER_OK = False
    logger.warning("[NotesIndexer] sentence-transformers not installed. Run: pip install sentence-transformers")

PDF_ENGINE = None
try:
    import pypdf  # type: ignore[import-untyped]
    PDF_ENGINE = "pypdf"
    PDF_OK = True
except ImportError:
    try:
        import PyPDF2  # type: ignore[import-untyped]
        PDF_ENGINE = "PyPDF2"
        PDF_OK = True
    except ImportError:
        PDF_OK = False

# ── Storage ────────────────────────────────────────────────────────────────────
_DATA_DIR  = Path(__file__).resolve().parent.parent / "data"
_DB_PATH   = _DATA_DIR / "notes_index.db"
EMBED_MODEL = os.getenv("MEMORY_EMBED_MODEL", "all-MiniLM-L6-v2")
CHUNK_SIZE  = int(os.getenv("NOTES_CHUNK_SIZE", "500"))
SUPPORTED_EXTS = {".md", ".txt", ".rst", ".pdf"}


def _cosine_similarity(a, b) -> float:
    import numpy as np
    a, b = np.array(a), np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom else 0.0


class NotesIndexer:
    """
    Indexes local notes/documents into a semantic vector store for RAG-style search.
    """

    def __init__(self, db_path: Path = _DB_PATH):
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._db_path = str(db_path)
        self._lock = threading.Lock()
        self._embedder = None
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._lock, self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS sources (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    path       TEXT NOT NULL UNIQUE,
                    file_count INTEGER DEFAULT 0,
                    chunk_count INTEGER DEFAULT 0,
                    indexed_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS chunks (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER NOT NULL,
                    file_path TEXT NOT NULL,
                    chunk_idx INTEGER NOT NULL,
                    content   TEXT NOT NULL,
                    vector    TEXT,
                    indexed_at REAL NOT NULL,
                    FOREIGN KEY(source_id) REFERENCES sources(id)
                );

                CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
            """)

    def _get_embedder(self):
        if not EMBEDDER_OK:
            return None
        if self._embedder is None:
            try:
                logger.info(f"[NotesIndexer] Loading embedder '{EMBED_MODEL}'...")
                self._embedder = SentenceTransformer(EMBED_MODEL)
                logger.info("[NotesIndexer] Embedder ready.")
            except Exception as e:
                logger.error(f"[NotesIndexer] Embedder load error: {e}")
        return self._embedder

    def _embed(self, text: str) -> list | None:
        emb = self._get_embedder()
        if emb is None:
            return None
        try:
            return emb.encode(text).tolist()
        except Exception:
            return None

    # ── Text extraction ────────────────────────────────────────────────────────

    def _extract_text(self, file_path: Path) -> str:
        """Extract raw text from .md, .txt, .rst, or .pdf."""
        ext = file_path.suffix.lower()
        if ext in (".md", ".txt", ".rst"):
            try:
                return file_path.read_text(encoding="utf-8", errors="replace")
            except Exception as e:
                logger.warning(f"[NotesIndexer] Cannot read {file_path}: {e}")
                return ""
        elif ext == ".pdf" and PDF_OK:
            try:
                text_parts = []
                if PDF_ENGINE == "pypdf":
                    reader = pypdf.PdfReader(str(file_path))
                else:
                    reader = PyPDF2.PdfReader(str(file_path))
                for page in reader.pages:
                    text_parts.append(page.extract_text() or "")
                return "\n".join(text_parts)
            except Exception as e:
                logger.warning(f"[NotesIndexer] PDF read failed {file_path}: {e}")
                return ""
        return ""

    def _chunk_text(self, text: str) -> list[str]:
        """Split text into ~CHUNK_SIZE character chunks at paragraph boundaries."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks = []
        current = []
        current_len = 0
        for para in paragraphs:
            if current_len + len(para) > CHUNK_SIZE and current:
                chunks.append("\n\n".join(current))
                current = []
                current_len = 0
            current.append(para)
            current_len += len(para)
        if current:
            chunks.append("\n\n".join(current))
        return chunks

    def _iter_files(self, folder: Path) -> Generator[Path, None, None]:
        """Recursively yield supported files in a folder."""
        for f in folder.rglob("*"):
            if f.is_file() and f.suffix.lower() in SUPPORTED_EXTS:
                yield f

    # ── Public API ─────────────────────────────────────────────────────────────

    def index_folder(self, folder_path: str, overwrite: bool = True) -> dict:
        """
        Index all supported files in a folder (recursive).
        Returns stats: {files_indexed, chunks_created, time_sec}
        """
        folder = Path(folder_path).expanduser().resolve()
        if not folder.exists() or not folder.is_dir():
            return {"ok": False, "error": f"Folder not found: {folder}"}

        logger.info(f"[NotesIndexer] Indexing folder: {folder}")
        t0 = time.time()

        with self._lock, self._get_conn() as conn:
            # Upsert source record
            conn.execute(
                "INSERT OR REPLACE INTO sources(path, file_count, chunk_count, indexed_at) "
                "VALUES (?, 0, 0, ?)",
                (str(folder), time.time()),
            )
            source_id = conn.execute(
                "SELECT id FROM sources WHERE path=?", (str(folder),)
            ).fetchone()["id"]

            if overwrite:
                conn.execute("DELETE FROM chunks WHERE source_id=?", (source_id,))

            files_done = 0
            chunks_done = 0

            for file_path in self._iter_files(folder):
                text = self._extract_text(file_path)
                if not text.strip():
                    continue
                chunks = self._chunk_text(text)
                for idx, chunk in enumerate(chunks):
                    vec = self._embed(chunk)
                    conn.execute(
                        "INSERT INTO chunks(source_id, file_path, chunk_idx, content, vector, indexed_at) "
                        "VALUES (?,?,?,?,?,?)",
                        (source_id, str(file_path), idx, chunk,
                         json.dumps(vec) if vec else None, time.time()),
                    )
                    chunks_done += 1
                files_done += 1
                logger.debug(f"[NotesIndexer] Indexed {file_path.name} ({len(chunks)} chunks)")

            conn.execute(
                "UPDATE sources SET file_count=?, chunk_count=? WHERE id=?",
                (files_done, chunks_done, source_id),
            )

        elapsed = round(time.time() - t0, 2)
        logger.info(f"[NotesIndexer] Done: {files_done} files, {chunks_done} chunks in {elapsed}s")
        return {
            "ok": True,
            "folder": str(folder),
            "files_indexed": files_done,
            "chunks_created": chunks_done,
            "time_sec": elapsed,
            "embedder": "active" if EMBEDDER_OK else "disabled (keyword fallback)",
        }

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """
        Semantic search across all indexed notes.
        Returns top-k matching chunks with source, snippet, and score.
        """
        if not query.strip():
            return []

        query_vec = self._embed(query)

        with self._lock, self._get_conn() as conn:
            rows = conn.execute(
                "SELECT file_path, chunk_idx, content, vector FROM chunks"
            ).fetchall()

        if not rows:
            return [{"info": "No notes indexed yet. Run: memory index <folder_path>"}]

        if query_vec is None:
            # Keyword fallback
            words = query.lower().split()
            results = []
            for row in rows:
                content_lower = row["content"].lower()
                score = sum(1 for w in words if w in content_lower) / max(len(words), 1)
                if score > 0:
                    results.append({
                        "source": row["file_path"],
                        "snippet": row["content"][:300],
                        "score": round(score, 3),
                        "chunk": row["chunk_idx"],
                    })
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        # Semantic search
        scored = []
        for row in rows:
            if not row["vector"]:
                continue
            try:
                vec = json.loads(row["vector"])
                sim = _cosine_similarity(query_vec, vec)
                scored.append({
                    "source": row["file_path"],
                    "snippet": row["content"][:300],
                    "score": round(sim, 4),
                    "chunk": row["chunk_idx"],
                })
            except Exception:
                pass

        scored.sort(key=lambda x: x["score"], reverse=True)
        results = [r for r in scored[:top_k] if r["score"] > 0.1]
        logger.info(f"[NotesIndexer] Search '{query}' -> {len(results)} results")
        return results

    def list_sources(self) -> list[dict]:
        """List all indexed source folders."""
        with self._lock, self._get_conn() as conn:
            rows = conn.execute(
                "SELECT path, file_count, chunk_count, indexed_at FROM sources ORDER BY indexed_at DESC"
            ).fetchall()
        return [
            {
                "path": r["path"],
                "files": r["file_count"],
                "chunks": r["chunk_count"],
                "indexed_at": r["indexed_at"],
            }
            for r in rows
        ]

    def remove_source(self, folder_path: str) -> dict:
        """Remove a source folder and all its chunks from the index."""
        folder = str(Path(folder_path).expanduser().resolve())
        with self._lock, self._get_conn() as conn:
            row = conn.execute("SELECT id FROM sources WHERE path=?", (folder,)).fetchone()
            if not row:
                return {"ok": False, "error": f"Source not found: {folder}"}
            conn.execute("DELETE FROM chunks WHERE source_id=?", (row["id"],))
            conn.execute("DELETE FROM sources WHERE id=?", (row["id"],))
        logger.info(f"[NotesIndexer] Removed source: {folder}")
        return {"ok": True, "removed": folder}

    def get_stats(self) -> dict:
        with self._lock, self._get_conn() as conn:
            return {
                "sources": conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0],
                "files_total": conn.execute("SELECT SUM(file_count) FROM sources").fetchone()[0] or 0,
                "chunks_total": conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0],
                "embedder_active": EMBEDDER_OK and self._embedder is not None,
                "db_path": self._db_path,
            }


# ── Module-level singleton ─────────────────────────────────────────────────────
_indexer: NotesIndexer | None = None


def get_notes_indexer() -> NotesIndexer:
    global _indexer
    if _indexer is None:
        _indexer = NotesIndexer()
    return _indexer
