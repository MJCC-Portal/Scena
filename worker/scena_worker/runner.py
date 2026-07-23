from __future__ import annotations

import json
import logging
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import httpx

from . import SUPPORTED_JOB_TYPES, VERSION
from .api import WorkerApi
from .core import Artifact, Settings, WorkerError, event, now, required, sha256, write_json
from .processors import process_media, upload

STOP = threading.Event()


class Heartbeat:
    def __init__(self, settings: Settings, job_id: str, lease_token: str):
        self.settings = settings
        self.job_id = job_id
        self.lease_token = lease_token
        self.stop = threading.Event()
        self.failed: WorkerError | None = None
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self) -> None:
        self.thread.start()

    def finish(self) -> None:
        self.stop.set()
        self.thread.join(timeout=5)

    def _run(self) -> None:
        while not self.stop.wait(self.settings.heartbeat_seconds):
            api = WorkerApi(self.settings)
            try:
                api.heartbeat(self.job_id, self.lease_token)
                event("heartbeat", job_id=self.job_id)
            except WorkerError as exc:
                self.failed = exc
                event("heartbeat_failed", logging.ERROR, job_id=self.job_id, error_code=exc.code)
                return
            finally:
                api.close()


class Worker:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.api = WorkerApi(settings)
        self.jobs = settings.cache / "jobs"
        self.failed = settings.cache / "failed"
        self.jobs.mkdir(parents=True, exist_ok=True)
        self.failed.mkdir(parents=True, exist_ok=True)

    def close(self) -> None:
        self.api.close()

    def run(self) -> None:
        identity = self.api.ping()
        event("worker_started", worker=identity.get("worker_name"), version=VERSION)
        while not STOP.is_set():
            try:
                if not self.once():
                    STOP.wait(self.settings.poll_seconds)
            except WorkerError as exc:
                event("poll_failed", logging.ERROR, error_code=exc.code, message=exc.safe_message)
                STOP.wait(min(self.settings.poll_seconds * 2, 30))
            except Exception:
                logging.getLogger("scena-worker").exception(json.dumps({"event": "worker_loop_exception"}))
                STOP.wait(10)
        event("worker_stopped")

    def once(self) -> bool:
        job = self.api.claim()
        if not job:
            return False
        self.process(job)
        return True

    def process(self, job: dict[str, Any]) -> None:
        job_id = valid_uuid(job.get("job_id"))
        lease_token = required(job.get("lease_token"), "lease_token")
        job_type = required(job.get("job_type"), "job_type")
        source = job.get("source")
        if not isinstance(source, dict):
            self._fail(job_id, lease_token, WorkerError("SOURCE_MISSING", "The source Asset is unavailable."))
            return
        if job_type not in SUPPORTED_JOB_TYPES:
            self._fail(job_id, lease_token, WorkerError("UNSUPPORTED_JOB_TYPE", f"Unsupported job type: {job_type}."))
            return

        work = self._new_work_dir(job_id)
        heartbeat = Heartbeat(self.settings, job_id, lease_token)
        heartbeat.start()
        started = time.monotonic()
        try:
            source_path = self._download(source, work)
            artifacts, page_count, metadata = process_media(job_type, source_path, work, self.settings.job_timeout)
            if heartbeat.failed:
                raise heartbeat.failed

            manifest_path = work / "outputs" / "manifest.json"
            manifest = {
                "schema_version": 1,
                "worker_version": VERSION,
                "job_id": job_id,
                "job_type": job_type,
                "processed_at": now(),
                "duration_ms": round((time.monotonic() - started) * 1000),
                "source": {
                    "filename": source.get("original_filename"),
                    "mime_type": source.get("mime_type"),
                    "size_bytes": source.get("size_bytes"),
                },
                "outputs": [
                    {
                        "relative_path": artifact.relative_path,
                        "variant_type": artifact.variant_type,
                        "mime_type": artifact.mime_type,
                        "page_number": artifact.page_number,
                        "size_bytes": artifact.path.stat().st_size,
                        "checksum_sha256": sha256(artifact.path),
                    }
                    for artifact in artifacts
                ],
            }
            write_json(manifest_path, manifest)
            manifest_artifact = Artifact(manifest_path, "manifest.json", "manifest", "application/json")
            artifacts.append(manifest_artifact)

            targets = self.api.upload_targets(job_id, lease_token, artifacts)
            target_map = {str(item.get("relative_path")): item for item in targets}
            completed: list[dict[str, Any]] = []
            manifest_object = ""
            for artifact in artifacts:
                target = target_map.get(artifact.relative_path)
                if not target:
                    raise WorkerError("UPLOAD_TARGET_MISSING", "An upload target was missing.")
                upload(required(target.get("signed_upload_url"), "signed_upload_url"), artifact, self.settings.request_timeout)
                object_path = required(target.get("object_path"), "object_path")
                completed.append(artifact.completion(object_path))
                if artifact is manifest_artifact:
                    manifest_object = object_path

            if heartbeat.failed:
                raise heartbeat.failed
            result = self.api.complete(
                job_id,
                lease_token,
                completed,
                manifest_object,
                page_count,
                {
                    **metadata,
                    "worker_name": self.settings.worker_name,
                    "worker_version": VERSION,
                    "processed_at": now(),
                },
            )
            event("job_completed", job_id=job_id, job_type=job_type, outputs=len(completed), status=result.get("status"))
            shutil.rmtree(work, ignore_errors=True)
        except WorkerError as exc:
            self._fail(job_id, lease_token, exc, work)
        except Exception:
            logging.getLogger("scena-worker").exception(json.dumps({"event": "job_exception", "job_id": job_id}))
            self._fail(job_id, lease_token, WorkerError("PROCESSING_FAILED", "Media processing failed unexpectedly."), work)
        finally:
            heartbeat.finish()

    def _new_work_dir(self, job_id: str) -> Path:
        work = (self.jobs / job_id).resolve()
        if self.jobs not in work.parents:
            raise WorkerError("INVALID_JOB_ID", "The job ID is invalid.")
        if work.exists():
            shutil.rmtree(work)
        (work / "source").mkdir(parents=True)
        (work / "outputs").mkdir()
        return work

    def _download(self, source: dict[str, Any], work: Path) -> Path:
        url = required(source.get("signed_download_url"), "signed_download_url")
        suffix = Path(str(source.get("original_filename") or "")).suffix.lower()
        if len(suffix) > 12 or not all(character.isalnum() or character == "." for character in suffix):
            suffix = ""
        destination = work / "source" / f"source{suffix}"
        expected = int(source.get("size_bytes") or 0)
        if expected > self.settings.max_download_bytes:
            raise WorkerError("SOURCE_TOO_LARGE", "The source Asset exceeds the worker size limit.")
        total = 0
        try:
            with httpx.stream("GET", url, timeout=self.settings.request_timeout, follow_redirects=True) as response:
                response.raise_for_status()
                with destination.open("wb") as output:
                    for chunk in response.iter_bytes(1024 * 1024):
                        total += len(chunk)
                        if total > self.settings.max_download_bytes:
                            raise WorkerError("SOURCE_TOO_LARGE", "The source Asset exceeds the worker size limit.")
                        output.write(chunk)
        except httpx.HTTPError as exc:
            raise WorkerError("SOURCE_DOWNLOAD_FAILED", "The source Asset could not be downloaded.") from exc
        if total == 0 or (expected and total != expected):
            raise WorkerError("SOURCE_DOWNLOAD_FAILED", "The downloaded source Asset was incomplete.")
        event("source_downloaded", bytes=total)
        return destination

    def _fail(self, job_id: str, lease_token: str, error: WorkerError, work: Path | None = None) -> None:
        event("job_failed", logging.ERROR, job_id=job_id, error_code=error.code, message=error.safe_message)
        try:
            self.api.fail(job_id, lease_token, error)
        except WorkerError as callback_error:
            event("fail_callback_failed", logging.ERROR, job_id=job_id, error_code=callback_error.code)
        if work and work.exists():
            destination = self.failed / f"{job_id}-{int(time.time())}"
            try:
                work.rename(destination)
            except OSError:
                shutil.rmtree(work, ignore_errors=True)


def valid_uuid(value: Any) -> str:
    try:
        return str(uuid.UUID(required(value, "job_id")))
    except ValueError as exc:
        raise WorkerError("INVALID_API_RESPONSE", "The API returned an invalid job ID.") from exc
