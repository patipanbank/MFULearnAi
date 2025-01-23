# Use Node.js LTS version as base image
FROM node:20-slim

# ติดตั้ง dependencies ที่จำเป็น
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libc6 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

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
EXPOSE 3000

# Start the application
CMD ["npm", "start"]