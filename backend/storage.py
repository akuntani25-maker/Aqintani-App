"""Penyimpanan foto produk di disk server (VPS).

Menggantikan penyimpanan cloud Emergent. Antarmuka fungsinya tetap sama
(put_object / get_object), jadi kode lain tidak perlu berubah.
Folder diatur lewat UPLOAD_DIR (default: ./uploads), dan ikut dibackup.
"""
import os
from pathlib import Path

APP_NAME = "aqintani"
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", Path(__file__).parent / "uploads")).resolve()

MIME_MAP = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "png": "image/png", "webp": "image/webp",
}


def init_storage(force: bool = False):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return str(UPLOAD_DIR)


def _safe_path(path: str) -> Path:
    target = (UPLOAD_DIR / path).resolve()
    if UPLOAD_DIR not in target.parents:
        raise ValueError("Path tidak valid")
    return target


def put_object(path: str, data: bytes, content_type: str) -> dict:
    target = _safe_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {"path": path, "size": len(data)}


def get_object(path: str):
    target = _safe_path(path)
    if not target.is_file():
        raise FileNotFoundError(path)
    ext = target.suffix.lstrip(".").lower()
    return target.read_bytes(), MIME_MAP.get(ext, "application/octet-stream")
