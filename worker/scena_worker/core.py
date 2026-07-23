from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import VERSION

LOG = logging.getLogger("scena-worker")


class WorkerError(RuntimeError):
    def __init__(self, code: str, safe_message: str):
        super().__init__(safe_message)
        self.code = code
        self.safe_message = safe_message


@dataclass(frozen=True)
class Settings:
    api_url: str
    token: str
    worker_name: str
    cache: Path
    poll_seconds: int
    lease_seconds: int
    heartbeat_seconds: int
    request_timeout: int
    job_timeout: int
    max_download_bytes: int

    @classmethod
    def load(cls) -> "Settings":
        return cls(
            api_url=env_required("SCENA_API_URL"),
            token=env_required("SCENA_WORKER_TOKEN"),
            worker_name=os.getenv("SCENA_WORKER_ID", "scena-media-01"),
            cache=Path(os.getenv("SCENA_CACHE_DIRECTORY", "/var/cache/scena-worker")).resolve(),
            poll_seconds=env_int("SCENA_POLL_SECONDS", 5, 1, 300),
            lease_seconds=env_int("SCENA_LEASE_SECONDS", 600, 60, 3600),
            heartbeat_seconds=env_int("SCENA_HEARTBEAT_SECONDS", 60, 15, 1800),
            request_timeout=env_int("SCENA_REQUEST_TIMEOUT_SECONDS", 60, 5, 300),
            job_timeout=env_int("SCENA_JOB_TIMEOUT_SECONDS", 1200, 60, 7200),
            max_download_bytes=env_int("SCENA_MAX_DOWNLOAD_BYTES", 275_000_000, 1_000_000, 300_000_000),
        )


@dataclass
class Artifact:
    path: Path
    relative_path: str
    variant_type: str
    mime_type: str
    page_number: int | None = None
    title: str | None = None
    width: int | None = None
    height: int | None = None
    metadata: dict[str, Any] | None = None

    def request(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "relative_path": self.relative_path,
            "variant_type": self.variant_type,
            "mime_type": self.mime_type,
        }
        if self.page_number is not None:
            value["page_number"] = self.page_number
        return value

    def completion(self, object_path: str) -> dict[str, Any]:
        value: dict[str, Any] = {
            **self.request(),
            "object_path": object_path,
            "size_bytes": self.path.stat().st_size,
            "checksum_sha256": sha256(self.path),
        }
        for name in ("title", "width", "height"):
            field = getattr(self, name)
            if field is not None:
                value[name] = field
        if self.metadata:
            value["metadata"] = self.metadata
        return value


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise WorkerError("CONFIGURATION_INVALID", f"{name} is required.")
    return value


def env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise WorkerError("CONFIGURATION_INVALID", f"{name} must be an integer.") from exc
    if not minimum <= value <= maximum:
        raise WorkerError("CONFIGURATION_INVALID", f"{name} must be between {minimum} and {maximum}.")
    return value


def required(value: Any, name: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise WorkerError("INVALID_API_RESPONSE", f"The API response omitted {name}.")
    return text


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    temporary.replace(path)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def event(name: str, level: int = logging.INFO, **fields: Any) -> None:
    LOG.log(level, json.dumps({"event": name, **fields}, default=str))


def health_payload() -> dict[str, Any]:
    import shutil
    import sys
    from . import SUPPORTED_JOB_TYPES

    programs = ["ffmpeg", "libreoffice", "pdfinfo", "pdftoppm"]
    missing = [program for program in programs if shutil.which(program) is None]
    if missing:
        raise WorkerError("PROCESSOR_MISSING", f"Missing programs: {', '.join(missing)}.")
    return {
        "ok": True,
        "worker_version": VERSION,
        "python": sys.version.split()[0],
        "supported_job_types": sorted(SUPPORTED_JOB_TYPES),
    }
