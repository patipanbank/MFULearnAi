from fastapi import FastAPI, UploadFile, File, HTTPException
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ocr-service"}

@app.post("/ocr")
async def ocr_process(file: UploadFile = File(...)):
    logger.info(f"Processing OCR for file: {file.filename} ({file.content_type})")
    try:
        contents = await file.read()
        text = ""

        if file.content_type == "application/pdf":
            # Convert PDF to images
            images = convert_from_bytes(contents)
            logger.info(f"Converted PDF to {len(images)} images")
            
            for i, image in enumerate(images):
                page_text = pytesseract.image_to_string(image)
                text += f"\n--- Page {i+1} ---\n{page_text}"
        
        elif file.content_type.startswith("image/"):
            image = Image.open(io.BytesIO(contents))
            text = pytesseract.image_to_string(image)
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Only PDF and Images allowed.")

        if not text.strip():
             logger.warning("OCR extracted empty text")
        
        return {"text": text, "filename": file.filename, "pages": 1} # Todo: real page count for layout awareness

    except Exception as e:
        logger.error(f"OCR Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
