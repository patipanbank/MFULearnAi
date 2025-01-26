# Use Node.js LTS version as base image
FROM node:20-alpine

# Install required dependencies for onnxruntime
RUN apk add --no-cache \
    libc6-compat \
    gcompat \
    build-base \
    python3

# Install required dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    build-base \
    tesseract-ocr \
    tesseract-ocr-data-tha \
    tesseract-ocr-data-eng \
    poppler-utils \
    imagemagick \
    ghostscript \
    imagemagick-dev

# Configure ImageMagick policy to allow PDF
COPY policy.xml /etc/ImageMagick-7/policy.xml

# Set working directory
WORKDIR /app

# สร้างโฟลเดอร์ uploads และกำหนดสิทธิ์
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install dependencies and TypeScript globally
RUN npm install -g typescript

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]