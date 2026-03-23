from fastapi import FastAPI, UploadFile, File, HTTPException, Body
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io
import logging
import os
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

minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE
)

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ocr-service"}

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
    text = ""
    if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        # Convert PDF to images
        images = convert_from_bytes(contents)
        logger.info(f"Converted PDF to {len(images)} images")
        
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
    
    return {"text": text, "filename": filename, "pages": 1}
