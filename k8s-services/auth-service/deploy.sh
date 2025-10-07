#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Auth Service Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found. Please install kubectl first.${NC}"
    exit 1
fi

# Check if we're on the right server
CURRENT_HOST=$(hostname)
if [[ "$CURRENT_HOST" != *"10.1.44.204"* ]] && [[ "$CURRENT_HOST" != "mfulearnai" ]]; then
    echo -e "${YELLOW}⚠️  Warning: You might not be on the production server (10.1.44.204)${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build Docker image
echo -e "${GREEN}📦 Building Docker image...${NC}"
docker build -t mfulearnai/auth-service:latest .

echo -e "${GREEN}✅ Docker image built successfully${NC}"

# Tag with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker tag mfulearnai/auth-service:latest mfulearnai/auth-service:$TIMESTAMP
echo -e "${GREEN}🏷️  Tagged as mfulearnai/auth-service:$TIMESTAMP${NC}"

# Create namespace if not exists
echo -e "${GREEN}🔧 Creating namespace...${NC}"
kubectl apply -f k8s/namespace.yaml

# Check if secret exists
if kubectl get secret auth-service-secrets -n mfulearnai &> /dev/null; then
    echo -e "${YELLOW}⚠️  Secret 'auth-service-secrets' already exists${NC}"
else
    echo -e "${RED}❌ Secret 'auth-service-secrets' not found${NC}"
    echo -e "${YELLOW}Please create k8s/secret.yaml from k8s/secret.yaml.example and apply it:${NC}"
    echo -e "${YELLOW}  cp k8s/secret.yaml.example k8s/secret.yaml${NC}"
    echo -e "${YELLOW}  # Edit k8s/secret.yaml with real values${NC}"
    echo -e "${YELLOW}  kubectl apply -f k8s/secret.yaml${NC}"
    exit 1
fi

# Apply ConfigMap
echo -e "${GREEN}🔧 Applying ConfigMap...${NC}"
kubectl apply -f k8s/configmap.yaml

# Apply Deployment
echo -e "${GREEN}🚀 Deploying Auth Service...${NC}"
kubectl apply -f k8s/deployment.yaml

# Apply HPA
echo -e "${GREEN}📊 Applying HPA...${NC}"
kubectl apply -f k8s/hpa.yaml

# Wait for deployment to be ready
echo -e "${GREEN}⏳ Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/auth-service -n mfulearnai --timeout=300s

# Show deployment status
echo -e "${GREEN}📋 Deployment Status:${NC}"
kubectl get pods -n mfulearnai -l app=auth-service
kubectl get svc -n mfulearnai auth-service
kubectl get hpa -n mfulearnai auth-service-hpa

# Show recent logs
echo -e "${GREEN}📝 Recent logs:${NC}"
kubectl logs -n mfulearnai -l app=auth-service --tail=20

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Auth Service deployed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}To view logs: kubectl logs -n mfulearnai -l app=auth-service -f${NC}"
echo -e "${YELLOW}To port-forward: kubectl port-forward -n mfulearnai svc/auth-service 3001:3001${NC}"
