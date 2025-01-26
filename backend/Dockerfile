# Use Node.js LTS version as base image
FROM node:20

# Install required dependencies using apt-get
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    build-essential \
    tesseract-ocr \
    tesseract-ocr-tha \
    tesseract-ocr-eng \
    poppler-utils \
    imagemagick \
    ghostscript \
    libmagickwand-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configure ImageMagick policy to allow PDF
COPY policy.xml /etc/ImageMagick-7/policy.xml

# Set working directory
WORKDIR /app

# Create uploads folder and set permissions
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
