FROM node:18-bullseye-slim

# Install Python and OCR dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-tha \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
RUN pip3 install pytesseract pdf2image Pillow

WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install Node deps
RUN npm install

# Copy source
COPY src ./src

# Build TS
RUN npm run build
COPY src/ocr.py dist/


# Copy python script to dist/src so it matches the path logic in worker.ts
# worker.ts expects ocr.py in __dirname, which will be dist/
# Actually worker.ts: path.join(__dirname, 'ocr.py') -> dist/ocr.py if we move it there
# Let's verify where tsc puts output. tsc puts src/worker.ts -> dist/worker.js
# So we need ocr.py in dist/ocr.py
RUN cp src/ocr.py dist/ocr.py

CMD ["npm", "start"]
