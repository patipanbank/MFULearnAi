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
        This is the core logic that works from memory.
        """
        ext = os.path.splitext(filename)[1].lower()
        text = ""

        try:
            if ext == '.pdf':
                # Use a BytesIO object to handle the byte content in memory
                with fitz.open(stream=file_content, filetype="pdf") as doc:
                    pdf_text = "".join(page.get_text() for page in doc)
                
                cleaned_pdf_text = self._clean_text(pdf_text)

                # Simple check if OCR is needed.
                if len(cleaned_pdf_text) < 100:
                    # OCR requires a file path, so we must write to a temp file
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
                        temp_pdf.write(file_content)
                        temp_pdf_path = temp_pdf.name
                    
                    try:
                        text = await self._ocr_pdf(temp_pdf_path)
                    finally:
                        os.remove(temp_pdf_path) # Clean up the temp file
                else:
                    text = cleaned_pdf_text

            elif ext in ['.doc', '.docx']:
                with io.BytesIO(file_content) as docx_file:
                    result = await asyncio.to_thread(mammoth.extract_raw_text, docx_file)
                    text = self._clean_text(result.value)

            elif ext in ['.xls', '.xlsx']:
                with io.BytesIO(file_content) as xlsx_file:
                    excel_file = pd.ExcelFile(xlsx_file)
                    sheets_content = []
                    for sheet_name in excel_file.sheet_names:
                        df = pd.read_excel(excel_file, sheet_name=sheet_name)
                        df.dropna(how='all', axis=0, inplace=True)
                        df.dropna(how='all', axis=1, inplace=True)
                        if not df.empty:
                            sheets_content.append(f"[Sheet: {sheet_name}]\n{df.to_csv(index=False)}")
                    text = self._clean_text("\n\n".join(sheets_content))
            
            elif ext == '.csv':
                 # Decode bytes to string for csv reader
                csv_string = file_content.decode('utf-8')
                with io.StringIO(csv_string) as csvfile:
                    reader = csv.reader(csvfile)
                    rows_content = []
                    for row in reader:
                        non_empty_values = [value for value in row if value and value.strip()]
                        if non_empty_values:
                             rows_content.append(','.join(non_empty_values))
                    text = self._clean_text('\n'.join(rows_content))

            elif ext == '.txt':
                text = self._clean_text(file_content.decode('utf-8'))

            else:
                # Fallback for unsupported but text-like files
                try:
                    text = self._clean_text(file_content.decode('utf-8'))
                except UnicodeDecodeError:
                    raise ValueError(f"Unsupported file type: {ext}")
        
        except Exception as e:
            print(f"Error processing file content for {filename}: {e}")
            # Re-raise to be handled by the caller
            raise ValueError(f"Failed to parse file {filename}") from e

        return text

    async def process_file(self, file: UploadFile) -> str:
        """
        Processes an uploaded file by reading its content and passing it to the core parsing logic.
        """
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