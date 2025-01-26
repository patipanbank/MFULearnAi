# Use Node.js LTS version as base image
FROM node:20-slim

# Install required system dependencies
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

# Set correct permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]