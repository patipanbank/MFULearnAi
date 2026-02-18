import sys
import json
import os
try:
    from PIL import Image
    import pytesseract
    from pdf2image import convert_from_path
except ImportError:
    # Fallback if dependencies missing in dev environment
    pass

def extract_text(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    text = ""

    try:
        if ext == '.pdf':
            images = convert_from_path(file_path)
            for i, image in enumerate(images):
                progress = int((i + 1) / len(images) * 100)
                print(f"PROGRESS: {progress}", flush=True)
                text += f"\n--- Page {i+1} ---\n"
                text += pytesseract.image_to_string(image)
        elif ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
            text = pytesseract.image_to_string(Image.open(file_path))
        else:
            # Fallback for text files if they got here
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
    except Exception as e:
        return { "error": str(e) }

    return { "blocks": [{ "fileName": os.path.basename(file_path), "text": text }] }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = extract_text(file_path)
    print(json.dumps(result))
