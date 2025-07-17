FROM python:3.11-slim

# ตั้งค่า Working Directory ใน Container
WORKDIR /app

# ติดตั้ง System Dependencies ที่จำเป็นสำหรับ build บาง package เช่น xmlsec และ lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libxml2-dev \
    libxmlsec1-dev \
    libxmlsec1-openssl \
    libxslt1-dev \
    zlib1g-dev \
    # Dependencies for OCR
    tesseract-ocr \
    tesseract-ocr-tha \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# คัดลอกไฟล์ requirements.txt และติดตั้ง dependencies ก่อน
# เพื่อใช้ประโยชน์จาก Docker layer caching
COPY requirements.txt .

# แก้ไขปัญหา lxml & xmlsec libxml2 library version mismatch
# โดยการติดตั้ง lxml แบบ no-binary เพื่อให้ compile จาก source
RUN pip install --no-cache-dir --no-binary lxml -r requirements.txt

# คัดลอกโค้ดโปรเจกต์ทั้งหมด
COPY . .

# Expose port ที่ application จะรัน
EXPOSE 5000

# ใช้ gunicorn master + UvicornWorker เพื่อสเกลหลาย process ตาม CPU
# ตัวอย่างนี้ใช้ 4 workers (ปรับโดยตั้ง ENV WORKERS หากต้องการ)
ENV WORKERS=4

# คำสั่งสำหรับรัน application
# gunicorn จะ fork UvicornWorker หลายตัวซึ่งรองรับ WebSocket ได้
CMD ["bash", "-c", "gunicorn --worker-class uvicorn.workers.UvicornWorker -w ${WORKERS} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:5000 --log-level debug --access-logfile - --error-logfile - main:app"] 