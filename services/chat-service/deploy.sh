#!/bin/bash

# Chat Service Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
NAMESPACE="mfulearnai"
SERVICE_NAME="chat-service"
IMAGE_TAG=${2:-latest}

echo "🚀 Deploying ${SERVICE_NAME} to ${ENVIRONMENT} environment..."

# Build Docker image
echo "📦 Building Docker image..."
docker build -t mfulearnai/${SERVICE_NAME}:${IMAGE_TAG} .

# Tag as latest if version specified
if [ "$IMAGE_TAG" != "latest" ]; then
  docker tag mfulearnai/${SERVICE_NAME}:${IMAGE_TAG} mfulearnai/${SERVICE_NAME}:latest
fi

# Push to registry (if configured)
if [ -n "$DOCKER_REGISTRY" ]; then
  echo "📤 Pushing to Docker registry..."
  docker tag mfulearnai/${SERVICE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/mfulearnai/${SERVICE_NAME}:${IMAGE_TAG}
  docker push ${DOCKER_REGISTRY}/mfulearnai/${SERVICE_NAME}:${IMAGE_TAG}
fi

# Create namespace if not exists
echo "📋 Ensuring namespace exists..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Check if secrets exist
echo "🔐 Checking secrets..."
if ! kubectl get secret chat-service-secrets -n ${NAMESPACE} &> /dev/null; then
  echo "❌ Error: chat-service-secrets not found!"
  echo "Please create secrets first:"
  echo "kubectl create secret generic chat-service-secrets \\"
  echo "  --from-literal=mongodb-uri=\"mongodb://...\" \\"
  echo "  --from-literal=redis-url=\"redis://...\" \\"
  echo "  --from-literal=jwt-secret=\"...\" \\"
  echo "  --from-literal=aws-access-key-id=\"...\" \\"
  echo "  --from-literal=aws-secret-access-key=\"...\" \\"
  echo "  -n ${NAMESPACE}"
  exit 1
fi

# Apply Kubernetes manifests
echo "☸️  Applying Kubernetes manifests..."
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl rollout status deployment/${SERVICE_NAME} -n ${NAMESPACE} --timeout=300s

# Show deployment status
echo "✅ Deployment complete!"
echo ""
echo "📊 Deployment status:"
kubectl get deployment ${SERVICE_NAME} -n ${NAMESPACE}
echo ""
echo "📋 Pods:"
kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME}
echo ""
echo "🔍 Recent logs:"
kubectl logs -n ${NAMESPACE} -l app=${SERVICE_NAME} --tail=20

# Update ingress
echo ""
echo "🌐 Updating ingress..."
kubectl apply -f ../../k8s/ingress.yaml

echo ""
echo "✅ ${SERVICE_NAME} deployed successfully!"
echo ""
echo "Access endpoints:"
echo "  - REST API: https://mfulearnai.mfu.ac.th/api/chat"
echo "  - WebSocket: wss://mfulearnai.mfu.ac.th/ws/chat"
echo "  - Health: https://mfulearnai.mfu.ac.th/api/chat/health"
