#!/bin/bash

set -e

echo "🚀 Deploying Department Service..."

# Build Docker image
echo "📦 Building Docker image..."
docker build -t mfulearnai/department-service:latest .

# Load image into kind cluster
echo "📥 Loading image into kind cluster..."
kind load docker-image mfulearnai/department-service:latest --name mfulearnai

# Apply Kubernetes manifests
echo "☸️  Applying Kubernetes manifests..."
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/hpa.yaml

# Wait for rollout
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/department-service --timeout=300s

# Show deployment status
echo "✅ Deployment completed!"
echo ""
echo "📊 Service status:"
kubectl get pods -l app=department-service
echo ""
kubectl get svc department-service
echo ""
echo "🔍 Test the service:"
echo "kubectl port-forward svc/department-service 3002:3002"
echo "curl http://localhost:3002/health"
