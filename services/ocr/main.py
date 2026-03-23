from fastapi import FastAPI, UploadFile, File, HTTPException, Body
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io
import logging
import os
import json
import requests
from typing import Any, Dict, List, Optional
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
TYPHOON_API_KEY = os.getenv("TYPHOON_API_KEY", "")
TYPHOON_MODEL = os.getenv("TYPHOON_OCR_MODEL", "typhoon-ocr-1.5")
TYPHOON_TASK_TYPE = os.getenv("TYPHOON_OCR_TASK_TYPE", "default")
TYPHOON_MAX_TOKENS = os.getenv("TYPHOON_OCR_MAX_TOKENS", "16384")
TYPHOON_TEMPERATURE = os.getenv("TYPHOON_OCR_TEMPERATURE", "0.1")
TYPHOON_TOP_P = os.getenv("TYPHOON_OCR_TOP_P", "0.6")
TYPHOON_REPETITION_PENALTY = os.getenv("TYPHOON_OCR_REPETITION_PENALTY", "1.2")
TYPHOON_TIMEOUT_SECONDS = int(os.getenv("TYPHOON_OCR_TIMEOUT_SECONDS", "180"))
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
    except Exception as e:
        logger.error(f"OCR Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# NEW: Read directly from MinIO
@app.post("/ocr-bucket")
async def ocr_bucket(payload: dict = Body(...)):
    bucket = payload.get("bucket")
    key = payload.get("key")
    logger.info(f"Processing OCR from Bucket: {bucket}/{key}")
    
    try:
        # Get Object from MinIO
        response = minio_client.get_object(bucket, key)
        file_data = response.read()
        response.close()
        response.release_conn()
        
        # Determine mimetype from key or headers? 
        # For now, let's assume PDF if ends with .pdf, else image
        filename = key.split('/')[-1]
        mimetype = "application/pdf" if filename.lower().endswith(".pdf") else "image/png"
        
        return process_ocr_data(file_data, mimetype, filename)
        
    except Exception as e:
        logger.error(f"MinIO OCR Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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


def process_ocr_via_typhoon(contents, content_type, filename):
    if not TYPHOON_API_KEY:
        logger.error("OCR provider is typhoon but TYPHOON_API_KEY is missing")
        raise HTTPException(status_code=500, detail="Typhoon OCR is not configured")

    form_data = {
        "model": TYPHOON_MODEL,
        "task_type": TYPHOON_TASK_TYPE,
        "max_tokens": str(TYPHOON_MAX_TOKENS),
        "temperature": str(TYPHOON_TEMPERATURE),
        "top_p": str(TYPHOON_TOP_P),
        "repetition_penalty": str(TYPHOON_REPETITION_PENALTY)
    }

    headers = {
        "Authorization": f"Bearer {TYPHOON_API_KEY}"
    }

    mime = content_type or _guess_content_type(filename)

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
        logger.error(f"Typhoon OCR request failed: {str(e)}")
        raise HTTPException(status_code=502, detail="Typhoon OCR request failed")

    if response.status_code != 200:
        logger.error(f"Typhoon OCR failed [{response.status_code}]: {response.text[:500]}")
        raise HTTPException(status_code=502, detail="Typhoon OCR failed")

    try:
        payload = response.json()
    except ValueError:
        logger.error("Typhoon OCR returned non-JSON response")
        raise HTTPException(status_code=502, detail="Typhoon OCR invalid response")

    text, page_count = _extract_text_from_typhoon_payload(payload)
    if not text.strip():
        logger.warning("Typhoon OCR extracted empty text")

    return {
        "text": text,
        "filename": filename,
        "pages": page_count,
        "provider": "typhoon",
        "model": TYPHOON_MODEL
    }


def _extract_text_from_typhoon_payload(payload: Dict[str, Any]) -> tuple[str, int]:
    results: List[Dict[str, Any]] = payload.get("results") or []
    if not isinstance(results, list):
        return "", 0

    extracted_texts: List[str] = []
    success_count = 0

    for result in results:
        if not isinstance(result, dict):
            continue

        if not result.get("success"):
            logger.warning(f"Typhoon OCR page failed: {result.get('error', 'Unknown error')}")
            continue

        message = result.get("message")
        content = _extract_content_from_message(message)
        if content:
            extracted_texts.append(content)
            success_count += 1

    return "\n".join(extracted_texts), success_count


def _extract_content_from_message(message: Any) -> str:
    if not isinstance(message, dict):
        return ""

    choices = message.get("choices")
    if not isinstance(choices, list) or len(choices) == 0:
        return ""

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        return ""

    msg = first_choice.get("message")
    if not isinstance(msg, dict):
        return ""

    content = msg.get("content", "")
    if not isinstance(content, str):
        return ""

    parsed = _parse_possible_json_content(content)
    if isinstance(parsed, dict):
        natural_text = parsed.get("natural_text")
        if isinstance(natural_text, str):
            return natural_text

    return content


def _parse_possible_json_content(content: str) -> Optional[Dict[str, Any]]:
    try:
        data = json.loads(content)
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
