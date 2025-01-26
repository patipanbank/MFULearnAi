# Use Node.js LTS version as base image
FROM node:20-alpine

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
    imagemagick-dev \
    curl

# Configure ImageMagick policy to allow PDF
COPY policy.xml /etc/ImageMagick-7/policy.xml

# Set working directory
WORKDIR /app

# สร้างโฟลเดอร์ uploads และกำหนดสิทธิ์
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Copy package files
COPY package*.json ./

# Install dependencies and TypeScript globally
RUN npm install
RUN npm install -g typescript

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]