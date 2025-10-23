#!/bin/bash

###############################################################################
# Deploy Script for MFU Learn AI - Improvements
# This script deploys the updated chat-service and frontend to Kubernetes
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="localhost:5000"
NAMESPACE="mfu-learn-ai"
SERVICES=("chat-service" "auth-service" "frontend")

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  MFU Learn AI - Deployment Script (Improvements)          ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Check if we're in the correct directory
if [ ! -f "package.json" ] && [ ! -d "services" ]; then
    echo -e "${RED}❌ Error: Not in MFULearnAi directory${NC}"
    echo "Please run this script from the MFULearnAi root directory"
    exit 1
fi

echo -e "${GREEN}✓ In correct directory${NC}"
echo ""

###############################################################################
# Step 1: Git Pull
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Pulling latest code from Git${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

git pull origin kube
echo -e "${GREEN}✓ Git pull completed${NC}"
echo ""

###############################################################################
# Step 2: Build Docker Images
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Building Docker Images${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get current timestamp for versioning
VERSION=$(date +%Y%m%d-%H%M%S)
echo -e "${YELLOW}Version: ${VERSION}${NC}"
echo ""

# Build chat-service
echo -e "${YELLOW}📦 Building chat-service...${NC}"
cd services/chat-service
docker build -t ${REGISTRY}/chat-service:${VERSION} -t ${REGISTRY}/chat-service:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ chat-service built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build chat-service${NC}"
    exit 1
fi
cd ../..

# Build auth-service
echo -e "${YELLOW}📦 Building auth-service...${NC}"
cd services/auth-service
docker build -t ${REGISTRY}/auth-service:${VERSION} -t ${REGISTRY}/auth-service:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ auth-service built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build auth-service${NC}"
    exit 1
fi
cd ../..

# Build frontend
echo -e "${YELLOW}📦 Building frontend...${NC}"
cd frontend
docker build -t ${REGISTRY}/frontend:${VERSION} -t ${REGISTRY}/frontend:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ frontend built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build frontend${NC}"
    exit 1
fi
cd ..

echo ""
echo -e "${GREEN}✓ All images built successfully${NC}"
echo ""

###############################################################################
# Step 3: Push Docker Images to Registry
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Pushing Images to Registry${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Push chat-service
echo -e "${YELLOW}⬆️  Pushing chat-service...${NC}"
docker push ${REGISTRY}/chat-service:${VERSION}
docker push ${REGISTRY}/chat-service:latest
echo -e "${GREEN}✓ chat-service pushed${NC}"

# Push auth-service
echo -e "${YELLOW}⬆️  Pushing auth-service...${NC}"
docker push ${REGISTRY}/auth-service:${VERSION}
docker push ${REGISTRY}/auth-service:latest
echo -e "${GREEN}✓ auth-service pushed${NC}"

# Push frontend
echo -e "${YELLOW}⬆️  Pushing frontend...${NC}"
docker push ${REGISTRY}/frontend:${VERSION}
docker push ${REGISTRY}/frontend:latest
echo -e "${GREEN}✓ frontend pushed${NC}"

echo ""
echo -e "${GREEN}✓ All images pushed to registry${NC}"
echo ""

###############################################################################
# Step 4: Deploy to Kubernetes
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Deploying to Kubernetes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Create namespace if not exists
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ Namespace verified${NC}"

# Deploy chat-service
echo -e "${YELLOW}🚀 Deploying chat-service...${NC}"
kubectl set image deployment/chat-service chat-service=${REGISTRY}/chat-service:${VERSION} -n ${NAMESPACE}
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ chat-service deployment updated${NC}"
else
    echo -e "${YELLOW}⚠️  chat-service deployment not found, applying manifest...${NC}"
    kubectl apply -f k8s/services/chat-service/deployment.yaml -n ${NAMESPACE}
fi

# Deploy auth-service
echo -e "${YELLOW}🚀 Deploying auth-service...${NC}"
kubectl set image deployment/auth-service auth-service=${REGISTRY}/auth-service:${VERSION} -n ${NAMESPACE}
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ auth-service deployment updated${NC}"
else
    echo -e "${YELLOW}⚠️  auth-service deployment not found, applying manifest...${NC}"
    kubectl apply -f k8s/services/auth-service/deployment.yaml -n ${NAMESPACE}
fi

# Deploy frontend
echo -e "${YELLOW}🚀 Deploying frontend...${NC}"
kubectl set image deployment/frontend frontend=${REGISTRY}/frontend:${VERSION} -n ${NAMESPACE}
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ frontend deployment updated${NC}"
else
    echo -e "${YELLOW}⚠️  frontend deployment not found, applying manifest...${NC}"
    kubectl apply -f k8s/services/frontend/deployment.yaml -n ${NAMESPACE}
fi

echo ""
echo -e "${GREEN}✓ All deployments updated${NC}"
echo ""

###############################################################################
# Step 5: Wait for Rollout
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Waiting for Rollout to Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Waiting for chat-service...${NC}"
kubectl rollout status deployment/chat-service -n ${NAMESPACE} --timeout=300s
echo -e "${GREEN}✓ chat-service rolled out${NC}"

echo -e "${YELLOW}⏳ Waiting for auth-service...${NC}"
kubectl rollout status deployment/auth-service -n ${NAMESPACE} --timeout=300s
echo -e "${GREEN}✓ auth-service rolled out${NC}"

echo -e "${YELLOW}⏳ Waiting for frontend...${NC}"
kubectl rollout status deployment/frontend -n ${NAMESPACE} --timeout=300s
echo -e "${GREEN}✓ frontend rolled out${NC}"

echo ""
echo -e "${GREEN}✓ All rollouts completed successfully${NC}"
echo ""

###############################################################################
# Step 6: Verify Deployment
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Verifying Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}📊 Pod Status:${NC}"
kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=chat-service -o wide
kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=auth-service -o wide
kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=frontend -o wide

echo ""
echo -e "${YELLOW}🔍 Service Status:${NC}"
kubectl get svc -n ${NAMESPACE} | grep -E "(chat-service|auth-service|frontend)"

echo ""
echo -e "${YELLOW}📝 Recent Pod Logs (last 10 lines):${NC}"
echo ""
echo -e "${BLUE}--- chat-service ---${NC}"
POD_NAME=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=chat-service -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$POD_NAME" ]; then
    kubectl logs -n ${NAMESPACE} ${POD_NAME} --tail=10
else
    echo -e "${RED}No chat-service pod found${NC}"
fi

echo ""
echo -e "${BLUE}--- auth-service ---${NC}"
POD_NAME=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=auth-service -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$POD_NAME" ]; then
    kubectl logs -n ${NAMESPACE} ${POD_NAME} --tail=10
else
    echo -e "${RED}No auth-service pod found${NC}"
fi

echo ""
echo -e "${BLUE}--- frontend ---${NC}"
POD_NAME=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=frontend -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$POD_NAME" ]; then
    kubectl logs -n ${NAMESPACE} ${POD_NAME} --tail=10
else
    echo -e "${RED}No frontend pod found${NC}"
fi

echo ""

###############################################################################
# Summary
###############################################################################

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Deployment Summary                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Git pull completed${NC}"
echo -e "${GREEN}✓ Docker images built (version: ${VERSION})${NC}"
echo -e "${GREEN}✓ Images pushed to registry${NC}"
echo -e "${GREEN}✓ Kubernetes deployments updated${NC}"
echo -e "${GREEN}✓ Rollouts completed successfully${NC}"
echo ""
echo -e "${BLUE}Deployed services:${NC}"
echo -e "  • chat-service:${VERSION}"
echo -e "  • auth-service:${VERSION}"
echo -e "  • frontend:${VERSION}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "  1. Test the application: http://10.1.44.204"
echo -e "  2. Check logs: kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=<service-name>"
echo -e "  3. Monitor pods: kubectl get pods -n ${NAMESPACE} -w"
echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
