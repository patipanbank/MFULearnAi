
# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies (for potential native modules like sharp, canvas, or python for some libs)
RUN apk add --no-cache python3 make g++

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 8080

# Start command
CMD ["npm", "start"]
