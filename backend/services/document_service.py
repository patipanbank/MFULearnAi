import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import mammoth
import pandas as pd
from io import BytesIO
import tempfile
import os
import subprocess
import asyncio
from fastapi import UploadFile
import csv
import io
from mimetypes import guess_type

class DocumentService:
    def _clean_text(self, text: str) -> str:
        """Removes extra whitespace and empty lines from text."""
        # Replace multiple spaces/newlines with a single space
        cleaned_text = ' '.join(text.strip().split())
        # Further remove isolated blank lines that might result from splitting
        return "\n".join(line for line in cleaned_text.split('\n') if line.strip())

    async def parse_file_content(self, file_content: bytes, filename: str) -> str:
        """
        Parses file content from bytes and extracts text based on the file extension.
        Supports: PDF, PNG, TXT, JPG/JPEG
        """
        ext = os.path.splitext(filename)[1].lower()
        text = ""
        
        try:
            # Handle PDF files
            if ext == '.pdf':
                with fitz.open(stream=file_content, filetype="pdf") as pdf:
                    for page in pdf:
                        text += page.get_text()
                    text = self._clean_text(text)

            # Handle image files (PNG, JPG, JPEG)
            elif ext in ['.png', '.jpg', '.jpeg']:
                image = Image.open(BytesIO(file_content))
                text = pytesseract.image_to_string(image)
                text = self._clean_text(text)

            # Handle text files
            elif ext == '.txt':
                text = self._clean_text(file_content.decode('utf-8'))

            else:
                raise ValueError(f"Unsupported file type: {ext}. Supported types are: PDF, PNG, TXT, JPG, JPEG")

            if not text.strip():
                raise ValueError(f"No text content could be extracted from the file: {filename}")

            return text

        except Exception as e:
            print(f"Error processing file content for {filename}: {e}")
            if "not authorized" in str(e).lower():
                raise ValueError("PDF is password protected. Please provide an unprotected PDF file.")
            elif "image" in str(e).lower():
                raise ValueError("Invalid or corrupted image file. Please provide a valid image file.")
            raise ValueError(f"Failed to parse file {filename}: {str(e)}")

    async def process_file(self, file: UploadFile) -> str:
        """
        Processes an uploaded file by reading its content and passing it to the core parsing logic.
        """
        if not file.filename:
            raise ValueError("File has no filename")
            
        # Check file extension
        ext = os.path.splitext(file.filename)[1].lower()
        supported_extensions = ['.pdf', '.png', '.txt', '.jpg', '.jpeg']
        if ext not in supported_extensions:
            raise ValueError(f"Unsupported file type: {ext}. Supported types are: {', '.join(supported_extensions)}")

        file_content = await file.read()
        return await self.parse_file_content(file_content, file.filename)

    async def _ocr_pdf(self, file_path: str) -> str:
        """
        Converts a PDF to images and uses Tesseract to perform OCR.
        """
        output_path_prefix = f"{file_path}_page"
        
        # Use pdftoppm to convert PDF to PNG images
        try:
            subprocess.run(
                ["pdftoppm", "-png", file_path, output_path_prefix],
                check=True,
                capture_output=True,
                text=True
            )
        except subprocess.CalledProcessError as e:
            print(f"Error during pdftoppm execution: {e.stderr}")
            raise
            
        # Get the list of generated image files
        image_files = sorted([f for f in os.listdir() if f.startswith(os.path.basename(output_path_prefix))])

        full_text = ""
        for image_file in image_files:
            try:
                # Perform OCR on each image
                # Specify Thai and English languages for Tesseract
                img_text = await asyncio.to_thread(
                    pytesseract.image_to_string, Image.open(image_file), lang='eng+tha'
                )
                full_text += img_text + "\n"
            finally:
                # Clean up the image file
                os.remove(image_file)
        
        return full_text

# Create an instance of the service
document_service = DocumentService() 