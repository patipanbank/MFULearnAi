from fastapi import FastAPI, UploadFile, File, HTTPException, Body
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io
import logging
import os
import json
import time
import requests
from typing import Any, Dict, List, Optional
from pypdf import PdfReader
from minio import Minio

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MinIO Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# Preferred OCR languages (Tesseract language codes). Default to Thai + English.
OCR_LANG = os.getenv("OCR_LANG", "tha+eng")

# Typhoon OCR configuration
TYPHOON_OCR_URL = os.getenv("TYPHOON_OCR_URL", "https://api.opentyphoon.ai/v1/ocr")
TYPHOON_API_KEY = (
    os.getenv("TYPHOON_API_KEY")
    or os.getenv("OPENTYPHOON_API_KEY")
    or os.getenv("OPEN_TYPHOON_API_KEY")
    or os.getenv("API_KEY")
    or ""
)
TYPHOON_MODEL = os.getenv("TYPHOON_OCR_MODEL", "typhoon-ocr-1.5")
TYPHOON_TASK_TYPE = os.getenv("TYPHOON_OCR_TASK_TYPE", "default")
TYPHOON_MAX_TOKENS = os.getenv("TYPHOON_OCR_MAX_TOKENS", "16384")
TYPHOON_TEMPERATURE = os.getenv("TYPHOON_OCR_TEMPERATURE", "0.1")
TYPHOON_TOP_P = os.getenv("TYPHOON_OCR_TOP_P", "0.6")
TYPHOON_REPETITION_PENALTY = os.getenv("TYPHOON_OCR_REPETITION_PENALTY", "1.2")
TYPHOON_TIMEOUT_SECONDS = int(os.getenv("TYPHOON_OCR_TIMEOUT_SECONDS", "180"))
TYPHOON_OCR_PAGES = os.getenv("TYPHOON_OCR_PAGES", "").strip()
TYPHOON_PAGE_RETRY_DELAY_MS = int(os.getenv("TYPHOON_OCR_PAGE_DELAY_MS", "200"))
OCR_FALLBACK_TO_TESSERACT = os.getenv("OCR_FALLBACK_TO_TESSERACT", "true").strip().lower() == "true"
OCR_PROVIDER = os.getenv("OCR_PROVIDER", "typhoon").strip().lower()

minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE
)

app = FastAPI()

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ocr-service",
        "provider": OCR_PROVIDER,
        "typhoon_configured": bool(TYPHOON_API_KEY)
    }

# Existing Direct Upload Endpoint (Backup)
@app.post("/ocr")
async def ocr_process(file: UploadFile = File(...)):
    logger.info(f"Processing OCR for file: {file.filename} ({file.content_type})")
    try:
        contents = await file.read()
        return process_ocr_data(contents, file.content_type, file.filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# NEW: Read directly from MinIO
@app.post("/ocr-bucket")
async def ocr_bucket(payload: dict = Body(...)):
    bucket = payload.get("bucket")
    key = payload.get("key")
    logger.info(f"Processing OCR from Bucket: {bucket}/{key}")
    
    response = None
    try:
        # Get Object from MinIO
        response = minio_client.get_object(bucket, key)
        file_data = response.read()
        
        # Determine mimetype from key or headers? 
        # For now, let's assume PDF if ends with .pdf, else image
        filename = key.split('/')[-1]
        mimetype = "application/pdf" if filename.lower().endswith(".pdf") else "image/png"
        
        return process_ocr_data(file_data, mimetype, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MinIO OCR Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if response is not None:
            try:
                response.close()
                response.release_conn()
            except Exception:
                pass

def process_ocr_data(contents, content_type, filename):
    if OCR_PROVIDER == "typhoon":
        return process_ocr_via_typhoon(contents, content_type, filename)

    return process_ocr_via_tesseract(contents, content_type, filename)


def process_ocr_via_tesseract(contents, content_type, filename):
    text = ""
    page_count = 1

    if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        # Convert PDF to images
        images = convert_from_bytes(contents)
        logger.info(f"Converted PDF to {len(images)} images")
        page_count = len(images)
        
        for i, image in enumerate(images):
            page_text = pytesseract.image_to_string(image, lang=OCR_LANG)
            text += f"\n--- Page {i+1} ---\n{page_text}"
    
    elif content_type.startswith("image/") or filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
        image = Image.open(io.BytesIO(contents))
        text = pytesseract.image_to_string(image, lang=OCR_LANG)
        
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Only PDF and Images allowed.")

    if not text.strip():
            logger.warning("OCR extracted empty text")
    
    return {
        "text": text,
        "filename": filename,
        "pages": page_count,
        "provider": "tesseract"
    }


def _get_pdf_page_count(contents: bytes) -> int:
    """Count the number of pages in a PDF from raw bytes using pypdf."""
    try:
        reader = PdfReader(io.BytesIO(contents))
        count = len(reader.pages)
        logger.info(f"PDF page count: {count}")
        return count
    except Exception as e:
        logger.warning(f"Failed to count PDF pages via pypdf: {e}. Defaulting to 1.")
        return 1


def _ocr_single_page(contents: bytes, mime: str, filename: str, page_num: int) -> Dict[str, Any]:
    """Send a single OCR request to Typhoon API for a specific page."""
    form_data = {
        "model": TYPHOON_MODEL,
        "task_type": TYPHOON_TASK_TYPE,
        "max_tokens": str(TYPHOON_MAX_TOKENS),
        "temperature": str(TYPHOON_TEMPERATURE),
        "top_p": str(TYPHOON_TOP_P),
        "repetition_penalty": str(TYPHOON_REPETITION_PENALTY),
        "page_num": str(page_num),
    }

    headers = {
        "Authorization": f"Bearer {TYPHOON_API_KEY}"
    }

    try:
        files = {
            "file": (filename, contents, mime)
        }
        response = requests.post(
            TYPHOON_OCR_URL,
            files=files,
            data=form_data,
            headers=headers,
            timeout=TYPHOON_TIMEOUT_SECONDS
        )
    except requests.RequestException as e:
        logger.error(f"Typhoon OCR request failed for page {page_num}: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Typhoon OCR request failed (page {page_num})")

    if response.status_code != 200:
        detail = _extract_typhoon_error_detail(response)
        logger.error(f"Typhoon OCR failed for page {page_num} [{response.status_code}]: {detail}")
        raise HTTPException(status_code=502, detail=f"Typhoon OCR failed (page {page_num}): {detail}")

    try:
        payload = response.json()
    except ValueError:
        logger.error(f"Typhoon OCR returned non-JSON response for page {page_num}")
        raise HTTPException(status_code=502, detail=f"Typhoon OCR invalid response (page {page_num})")

    return payload


def process_ocr_via_typhoon(contents, content_type, filename):
    if not TYPHOON_API_KEY:
        logger.error("OCR provider is typhoon but TYPHOON_API_KEY is missing")
        raise HTTPException(status_code=503, detail="Typhoon OCR is not configured")

    mime = content_type or _guess_content_type(filename)
    is_pdf = (mime == "application/pdf" or filename.lower().endswith(".pdf"))

    # ---------- Determine which pages to process ----------
    if is_pdf:
        total_pages = _get_pdf_page_count(contents)
        target_pages = _resolve_target_pages(total_pages)
    else:
        # Images are always single-page
        total_pages = 1
        target_pages = [1]

    logger.info(
        f"Typhoon OCR: file={filename}, is_pdf={is_pdf}, "
        f"total_pages={total_pages}, target_pages={target_pages}"
    )

    # ---------- Process each page ----------
    all_page_texts: List[str] = []
    processed_count = 0

    for idx, page_num in enumerate(target_pages):
        logger.info(f"Typhoon OCR: processing page {page_num}/{total_pages} ({idx+1}/{len(target_pages)})")

        payload = _ocr_single_page(contents, mime, filename, page_num)
        logger.info(f"Typhoon OCR page {page_num} response: {_summarize_typhoon_payload(payload)}")

        page_text, _ = _extract_text_from_typhoon_payload(payload)

        if page_text.strip():
            if len(target_pages) > 1:
                all_page_texts.append(f"--- Page {page_num} ---\n{page_text.strip()}")
            else:
                all_page_texts.append(page_text.strip())
            processed_count += 1
        else:
            logger.warning(f"Typhoon OCR page {page_num} returned empty text")

        # Delay between requests to avoid rate-limiting (skip after last page)
        if idx < len(target_pages) - 1 and TYPHOON_PAGE_RETRY_DELAY_MS > 0:
            time.sleep(TYPHOON_PAGE_RETRY_DELAY_MS / 1000.0)

    combined_text = "\n".join(all_page_texts)

    # ---------- Handle empty results ----------
    if not combined_text.strip():
        logger.warning(f"Typhoon OCR extracted empty text for all {len(target_pages)} pages")
        if OCR_FALLBACK_TO_TESSERACT:
            logger.warning("Falling back to Tesseract OCR due to empty Typhoon output")
            fallback = process_ocr_via_tesseract(contents, content_type, filename)
            fallback["provider"] = "tesseract-fallback"
            fallback["fallback_from"] = "typhoon"
            return fallback

        raise HTTPException(status_code=422, detail="Typhoon OCR returned empty text")

    return {
        "text": combined_text,
        "filename": filename,
        "pages": processed_count,
        "provider": "typhoon",
        "model": TYPHOON_MODEL
    }


def _extract_text_from_typhoon_payload(payload: Dict[str, Any]) -> tuple[str, int]:
    results: List[Dict[str, Any]] = payload.get("results") or []
    if not isinstance(results, list):
        return "", 0

    extracted_texts: List[str] = []
    total_pages = 0

    for result in results:
        if not isinstance(result, dict):
            continue

        if not result.get("success"):
            logger.warning(f"Typhoon OCR page failed: {result.get('error', 'Unknown error')}")
            continue

        message = result.get("message")
        content, content_pages = _extract_content_from_message(message)
        if content:
            extracted_texts.append(content)
            total_pages += max(content_pages, 1)
        else:
            logger.warning(
                f"Typhoon OCR success result had no extractable content at index={result.get('index', '?')} "
                f"message_keys={list(message.keys()) if isinstance(message, dict) else 'n/a'}"
            )

    if total_pages == 0 and extracted_texts:
        total_pages = 1

    return "\n".join(extracted_texts), total_pages


def _extract_content_from_message(message: Any) -> tuple[str, int]:
    if not isinstance(message, dict):
        return "", 0

    choices = message.get("choices")
    if not isinstance(choices, list) or len(choices) == 0:
        return "", 0

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        return "", 0

    msg = first_choice.get("message")
    if not isinstance(msg, dict):
        return "", 0

    content = msg.get("content", "")
    if isinstance(content, list):
        list_chunks: List[str] = []
        for part in content:
            if isinstance(part, dict):
                if isinstance(part.get("text"), str):
                    list_chunks.append(part.get("text", ""))
                    continue

                inner = part.get("content")
                if isinstance(inner, str):
                    list_chunks.append(inner)
                    continue

                if isinstance(inner, dict):
                    if isinstance(inner.get("text"), str):
                        list_chunks.append(inner.get("text", ""))
                        continue

                    if isinstance(inner.get("content"), str):
                        list_chunks.append(inner.get("content", ""))

        joined = "\n".join(list_chunks)
        if joined.strip():
            return joined, _estimate_page_count_from_text(joined)
        return "", 0

    if not isinstance(content, str):
        return "", 0

    parsed = _parse_possible_json_content(content)
    if isinstance(parsed, dict):
        joined, page_count = _extract_text_from_structured_dict(parsed)
        if joined:
            return joined, page_count

    return content, _estimate_page_count_from_text(content)


def _parse_possible_json_content(content: str) -> Optional[Dict[str, Any]]:
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = _strip_code_fence(stripped)

    try:
        data = json.loads(stripped)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        return None
    return None


def _guess_content_type(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        return "image/jpeg"
    if lower.endswith(".tiff"):
        return "image/tiff"
    if lower.endswith(".bmp"):
        return "image/bmp"
    return "application/octet-stream"


def _extract_text_from_structured_dict(data: Dict[str, Any]) -> tuple[str, int]:
    chunks: List[str] = []
    page_count = 0

    natural_text = data.get("natural_text")
    if isinstance(natural_text, str) and natural_text.strip():
        chunks.append(natural_text.strip())

    pages = data.get("pages")
    if isinstance(pages, list):
        for idx, page in enumerate(pages, start=1):
            if isinstance(page, dict):
                page_text = page.get("natural_text") or page.get("text") or page.get("content")
                if isinstance(page_text, str) and page_text.strip():
                    chunks.append(f"--- Page {idx} ---\n{page_text.strip()}")
                    page_count += 1

    if not chunks:
        # Fallback: stringify key textual fields if available
        for key in ("text", "content", "output"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                chunks.append(value.strip())
                break

    joined = "\n".join(chunks).strip()
    if page_count == 0 and joined:
        page_count = _estimate_page_count_from_text(joined)

    return joined, page_count


def _estimate_page_count_from_text(text: str) -> int:
    if not text:
        return 0
    markers = text.count("--- Page ")
    return markers if markers > 0 else 1


def _parse_pages_env(raw: str) -> Optional[List[int]]:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list) and all(isinstance(x, int) and x > 0 for x in parsed):
            return parsed
    except json.JSONDecodeError:
        return None
    return None


def _strip_code_fence(value: str) -> str:
    lines = value.splitlines()
    if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1]).strip()
    return value


def _summarize_typhoon_payload(payload: Dict[str, Any]) -> str:
    if not isinstance(payload, dict):
        return "non-dict payload"

    results = payload.get("results")
    if not isinstance(results, list):
        return f"keys={list(payload.keys())} results_type={type(results).__name__}"

    summary_parts: List[str] = [f"results={len(results)}"]

    for idx, result in enumerate(results[:3]):
        if not isinstance(result, dict):
            summary_parts.append(f"r{idx}=non-dict")
            continue

        success = result.get("success")
        message = result.get("message")
        error = result.get("error")
        msg_type = type(message).__name__
        choices_len = 0
        content_type = "none"
        content_len = 0

        if isinstance(message, dict):
            choices = message.get("choices")
            if isinstance(choices, list):
                choices_len = len(choices)
                if choices:
                    first = choices[0]
                    if isinstance(first, dict):
                        msg = first.get("message")
                        if isinstance(msg, dict):
                            content = msg.get("content")
                            content_type = type(content).__name__
                            if isinstance(content, str):
                                content_len = len(content)
                            elif isinstance(content, list):
                                content_len = len(content)

        summary_parts.append(
            f"r{idx}(success={success},msg={msg_type},choices={choices_len},contentType={content_type},contentSize={content_len},error={'yes' if error else 'no'})"
        )

    return " | ".join(summary_parts)


def _extract_typhoon_error_detail(response: requests.Response) -> str:
    text = (response.text or "").strip()
    if not text:
        return f"HTTP {response.status_code}"

    try:
        data = response.json()
        if isinstance(data, dict):
            detail = data.get("error") or data.get("detail") or data.get("message")
            if isinstance(detail, str) and detail.strip():
                return detail.strip()
    except ValueError:
        pass

    return text[:500]


def _resolve_target_pages(total_pages: int) -> List[int]:
    pages = _parse_pages_env(TYPHOON_OCR_PAGES) if TYPHOON_OCR_PAGES else None
    if not pages:
        return list(range(1, total_pages + 1))

    # keep only valid pages and preserve order
    valid = [p for p in pages if 1 <= p <= total_pages]
    return valid if valid else list(range(1, total_pages + 1))


def _sleep_retry_backoff(attempt: int) -> None:
    # simple linear/exponential hybrid without external deps
    delay_ms = TYPHOON_PAGE_RETRY_DELAY_MS * attempt
    time.sleep(max(0, delay_ms) / 1000.0)
