from __future__ import annotations

from typing import Any

import httpx

from . import VERSION
from .core import Artifact, Settings, WorkerError


class WorkerApi:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = httpx.Client(
            headers={
                "Authorization": f"Bearer {settings.token}",
                "Content-Type": "application/json",
                "User-Agent": f"scena-worker/{VERSION}",
            },
            timeout=settings.request_timeout,
            follow_redirects=True,
        )

    def close(self) -> None:
        self.client.close()

    def call(self, action: str, **payload: Any) -> dict[str, Any]:
        try:
            response = self.client.post(self.settings.api_url, json={"action": action, **payload})
        except httpx.HTTPError as exc:
            raise WorkerError("API_UNAVAILABLE", "The Scena worker API is unavailable.") from exc
        if response.status_code >= 400:
            code = f"HTTP_{response.status_code}"
            message = "The Scena worker API rejected the request."
            try:
                error = response.json().get("error", {})
                code = str(error.get("code") or code)
                message = str(error.get("message") or message)
            except (ValueError, AttributeError):
                pass
            raise WorkerError(code, message)
        try:
            data = response.json()
        except ValueError as exc:
            raise WorkerError("INVALID_API_RESPONSE", "The worker API returned invalid JSON.") from exc
        if not isinstance(data, dict):
            raise WorkerError("INVALID_API_RESPONSE", "The worker API returned an invalid response.")
        return data

    def ping(self) -> dict[str, Any]:
        return self.call("ping")

    def claim(self) -> dict[str, Any] | None:
        job = self.call("claim", lease_seconds=self.settings.lease_seconds).get("job")
        return job if isinstance(job, dict) else None

    def heartbeat(self, job_id: str, lease_token: str) -> None:
        self.call(
            "heartbeat",
            job_id=job_id,
            lease_token=lease_token,
            lease_seconds=self.settings.lease_seconds,
        )

    def upload_targets(self, job_id: str, lease_token: str, artifacts: list[Artifact]) -> list[dict[str, Any]]:
        outputs = self.call(
            "upload_targets",
            job_id=job_id,
            lease_token=lease_token,
            outputs=[artifact.request() for artifact in artifacts],
        ).get("outputs")
        if not isinstance(outputs, list):
            raise WorkerError("INVALID_API_RESPONSE", "The API did not return upload targets.")
        return [item for item in outputs if isinstance(item, dict)]

    def complete(
        self,
        job_id: str,
        lease_token: str,
        outputs: list[dict[str, Any]],
        manifest_path: str,
        page_count: int | None,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        return self.call(
            "complete",
            job_id=job_id,
            lease_token=lease_token,
            outputs=outputs,
            manifest_path=manifest_path,
            page_count=page_count,
            asset_metadata=metadata,
        )

    def fail(self, job_id: str, lease_token: str, error: WorkerError) -> None:
        self.call(
            "fail",
            job_id=job_id,
            lease_token=lease_token,
            error_code=error.code[:120],
            error_message_safe=error.safe_message[:500],
        )
