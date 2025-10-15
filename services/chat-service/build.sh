#!/bin/bash

# Chat Service Build Script
# Usage: ./build.sh [tag]

set -e

SERVICE_NAME="chat-service"
IMAGE_TAG=${1:-latest}

echo "🔨 Building ${SERVICE_NAME}..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run TypeScript compiler
echo "🔧 Compiling TypeScript..."
npm run build

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t mfulearnai/${SERVICE_NAME}:${IMAGE_TAG} .

echo "✅ Build complete!"
echo ""
echo "Docker image: mfulearnai/${SERVICE_NAME}:${IMAGE_TAG}"
echo ""
echo "To run locally:"
echo "  docker run -p 5002:5002 --env-file .env mfulearnai/${SERVICE_NAME}:${IMAGE_TAG}"
echo ""
echo "To deploy to Kubernetes:"
echo "  ./deploy.sh"
