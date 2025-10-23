#!/bin/bash
###############################################################################
# Quick Deployment Script for Server
# Run this on mfulearnai@10.1.44.204
###############################################################################

set -e

echo "🚀 MFU Learn AI - Quick Deployment"
echo "=================================="
echo ""

# Configuration
REGISTRY="localhost:5000"
NAMESPACE="mfu-learn-ai"
VERSION=$(date +%Y%m%d-%H%M%S)

# Navigate to project directory
cd ~/MFULearnAi

echo "📥 Step 1: Pull latest code..."
git pull origin kube
echo "✅ Code updated"
echo ""

echo "🔨 Step 2: Build Docker images..."
echo "Building chat-service..."
cd services/chat-service
docker build -t ${REGISTRY}/chat-service:${VERSION} -t ${REGISTRY}/chat-service:latest . || { echo "❌ Failed to build chat-service"; exit 1; }
cd ../..

echo "Building frontend..."
cd frontend
docker build -t ${REGISTRY}/frontend:${VERSION} -t ${REGISTRY}/frontend:latest . || { echo "❌ Failed to build frontend"; exit 1; }
cd ..

echo "✅ Images built"
echo ""

echo "⬆️  Step 3: Push to registry..."
docker push ${REGISTRY}/chat-service:${VERSION}
docker push ${REGISTRY}/chat-service:latest
docker push ${REGISTRY}/frontend:${VERSION}
docker push ${REGISTRY}/frontend:latest
echo "✅ Images pushed"
echo ""

echo "🚀 Step 4: Deploy to Kubernetes..."
kubectl set image deployment/chat-service chat-service=${REGISTRY}/chat-service:${VERSION} -n ${NAMESPACE} 2>/dev/null || \
  kubectl apply -f k8s/services/chat-service/deployment.yaml -n ${NAMESPACE}

kubectl set image deployment/frontend frontend=${REGISTRY}/frontend:${VERSION} -n ${NAMESPACE} 2>/dev/null || \
  kubectl apply -f k8s/services/frontend/deployment.yaml -n ${NAMESPACE}

echo "✅ Deployments updated"
echo ""

echo "⏳ Step 5: Wait for rollout..."
kubectl rollout status deployment/chat-service -n ${NAMESPACE} --timeout=180s
kubectl rollout status deployment/frontend -n ${NAMESPACE} --timeout=180s
echo "✅ Rollout completed"
echo ""

echo "📊 Step 6: Check status..."
kubectl get pods -n ${NAMESPACE} | grep -E "(chat-service|frontend)"
echo ""

echo "✅ Deployment completed successfully!"
echo "Version: ${VERSION}"
echo ""
echo "Check logs with:"
echo "  kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=chat-service --tail=50"
echo "  kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=frontend --tail=50"
