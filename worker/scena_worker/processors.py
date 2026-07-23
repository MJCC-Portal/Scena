from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

import httpx
from PIL import Image, ImageOps

from .core import Artifact, WorkerError, event

Image.MAX_IMAGE_PIXELS = 100_000_000


def process_media(
    job_type: str, source: Path, work: Path, timeout: int
) -> tuple[list[Artifact], int | None, dict[str, Any]]:
    if job_type == "image_ingest":
        return process_image(source, work)
    if job_type == "pdf_import":
        return render_pdf(source, work, timeout, None)
    if job_type == "powerpoint_import":
        converted = work / "converted"
        converted.mkdir()
        lo_home = work / "libreoffice-home"
        lo_home.mkdir()
        run_command(
            [
                "libreoffice",
                "--headless",
                "--nologo",
                "--nodefault",
                "--nolockcheck",
                "--nofirststartwizard",
                "--convert-to",
                "pdf",
                "--outdir",
                str(converted),
                str(source),
            ],
            timeout,
            "POWERPOINT_CONVERSION_FAILED",
            "The PowerPoint could not be converted.",
            {**os.environ, "HOME": str(lo_home)},
        )
        candidates = list(converted.glob("*.pdf"))
        if len(candidates) != 1:
            raise WorkerError("POWERPOINT_CONVERSION_FAILED", "PowerPoint conversion produced no PDF.")
        artifacts, count, metadata = render_pdf(candidates[0], work, timeout, "powerpoint")
        converted_output = work / "outputs" / "converted.pdf"
        shutil.copy2(candidates[0], converted_output)
        artifacts.insert(0, Artifact(converted_output, "document/converted.pdf", "other", "application/pdf"))
        return artifacts, count, metadata
    raise WorkerError("UNSUPPORTED_JOB_TYPE", f"Unsupported job type: {job_type}.")


def process_image(source: Path, work: Path) -> tuple[list[Artifact], None, dict[str, Any]]:
    normalized_path = work / "outputs" / "normalized.webp"
    thumbnail_path = work / "outputs" / "thumbnail.webp"
    try:
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            image.load()
            source_size = image.size
            image = image.convert("RGBA" if image.mode in ("RGBA", "LA") or "transparency" in image.info else "RGB")
            normalized = image.copy()
            normalized.thumbnail((3840, 3840), Image.Resampling.LANCZOS)
            normalized.save(normalized_path, "WEBP", quality=90, method=4)
            thumbnail = image.copy()
            thumbnail.thumbnail((512, 512), Image.Resampling.LANCZOS)
            thumbnail.save(thumbnail_path, "WEBP", quality=82, method=4)
    except (OSError, ValueError) as exc:
        raise WorkerError("IMAGE_DECODE_FAILED", "The image could not be decoded.") from exc
    return [
        Artifact(
            normalized_path,
            "image/normalized.webp",
            "source_render",
            "image/webp",
            width=normalized.width,
            height=normalized.height,
        ),
        Artifact(
            thumbnail_path,
            "image/thumbnail.webp",
            "thumbnail",
            "image/webp",
            width=thumbnail.width,
            height=thumbnail.height,
        ),
    ], None, {
        "source_width": source_size[0],
        "source_height": source_size[1],
        "normalized_width": normalized.width,
        "normalized_height": normalized.height,
    }


def render_pdf(
    pdf: Path, work: Path, timeout: int, converted_from: str | None
) -> tuple[list[Artifact], int, dict[str, Any]]:
    info = run_command(
        ["pdfinfo", str(pdf)],
        timeout,
        "PDF_INSPECTION_FAILED",
        "The PDF could not be inspected.",
    ).stdout
    info_map = {}
    for line in info.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            info_map[key.strip()] = value.strip()
    try:
        page_count = int(info_map.get("Pages", "0"))
    except ValueError as exc:
        raise WorkerError("PDF_PAGE_COUNT_INVALID", "The PDF page count was invalid.") from exc
    if page_count < 1 or page_count > 500:
        raise WorkerError("PDF_PAGE_COUNT_INVALID", "The PDF must contain between 1 and 500 pages.")

    rendered = work / "rendered"
    rendered.mkdir()
    run_command(
        ["pdftoppm", "-png", "-r", "150", str(pdf), str(rendered / "page")],
        timeout,
        "PDF_RENDER_FAILED",
        "The PDF pages could not be rendered.",
    )
    pages = sorted(rendered.glob("page-*.png"), key=lambda path: int("".join(c for c in path.stem if c.isdigit()) or 0))
    if len(pages) != page_count:
        raise WorkerError("PDF_RENDER_INCOMPLETE", "The PDF renderer did not produce every page.")

    artifacts: list[Artifact] = []
    for page_number, page in enumerate(pages, start=1):
        full = work / "outputs" / f"page-{page_number:04d}.webp"
        thumb = work / "outputs" / f"page-{page_number:04d}-thumbnail.webp"
        try:
            with Image.open(page) as opened:
                image = opened.convert("RGB")
                image.save(full, "WEBP", quality=92, method=4)
                thumbnail = image.copy()
                thumbnail.thumbnail((512, 512), Image.Resampling.LANCZOS)
                thumbnail.save(thumb, "WEBP", quality=82, method=4)
        except OSError as exc:
            raise WorkerError("PDF_PAGE_ENCODE_FAILED", "A rendered PDF page could not be encoded.") from exc
        metadata = {"source": converted_from or "pdf"}
        artifacts.extend([
            Artifact(
                full,
                f"pages/page-{page_number:04d}.webp",
                "source_render",
                "image/webp",
                page_number=page_number,
                title=f"Page {page_number}",
                width=image.width,
                height=image.height,
                metadata=metadata,
            ),
            Artifact(
                thumb,
                f"pages/page-{page_number:04d}-thumbnail.webp",
                "thumbnail",
                "image/webp",
                page_number=page_number,
                title=f"Page {page_number}",
                width=thumbnail.width,
                height=thumbnail.height,
                metadata=metadata,
            ),
        ])
    result: dict[str, Any] = {"page_count": page_count, "pdf_info": info_map}
    if converted_from:
        result["converted_from"] = converted_from
    return artifacts, page_count, result


def upload(url: str, artifact: Artifact, timeout: int) -> None:
    try:
        with artifact.path.open("rb") as source:
            response = httpx.put(
                url,
                content=source,
                headers={"Content-Type": artifact.mime_type, "x-upsert": "true"},
                timeout=timeout,
                follow_redirects=True,
            )
        response.raise_for_status()
    except (OSError, httpx.HTTPError) as exc:
        raise WorkerError("OUTPUT_UPLOAD_FAILED", "A processed output could not be uploaded.") from exc


def run_command(
    command: list[str],
    timeout: int,
    code: str,
    message: str,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
    except FileNotFoundError as exc:
        raise WorkerError("PROCESSOR_MISSING", "A required media-processing program is missing.") from exc
    except subprocess.TimeoutExpired as exc:
        raise WorkerError("PROCESSING_TIMEOUT", "Media processing exceeded its time limit.") from exc
    except subprocess.CalledProcessError as exc:
        event(
            "processor_failed",
            logging.ERROR,
            program=command[0],
            return_code=exc.returncode,
            stderr=(exc.stderr or "")[-1000:],
        )
        raise WorkerError(code, message) from exc
