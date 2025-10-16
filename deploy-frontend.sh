#!/bin/bash

# Frontend Deployment Script
# Run this on the production server: ssh mfulearnai@10.1.44.204

set -e  # Exit on error

echo "=========================================="
echo "Frontend Deployment to Production"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Pull latest code
echo -e "${YELLOW}Step 1: Pulling latest code from Git...${NC}"
cd /home/mfulearnai/MFULearnAi
git fetch origin kube
git reset --hard origin/kube
echo -e "${GREEN}✓ Code updated to latest version${NC}"
echo ""

# Step 2: Show what changed
echo -e "${YELLOW}Recent commits:${NC}"
git log --oneline -5
echo ""

# Step 3: Build frontend Docker image
echo -e "${YELLOW}Step 2: Building frontend Docker image...${NC}"
cd /home/mfulearnai/MFULearnAi/frontend
docker build -t mfulearnai/frontend:latest .
echo -e "${GREEN}✓ Docker image built successfully${NC}"
echo ""

# Step 4: Check current pods
echo -e "${YELLOW}Step 3: Current frontend pods:${NC}"
kubectl get pods -n mfulearnai -l app=frontend
echo ""

# Step 5: Restart frontend deployment
echo -e "${YELLOW}Step 4: Restarting frontend deployment...${NC}"
kubectl rollout restart deployment frontend -n mfulearnai
echo -e "${GREEN}✓ Deployment restart initiated${NC}"
echo ""

# Step 6: Wait for rollout to complete
echo -e "${YELLOW}Step 5: Waiting for rollout to complete...${NC}"
kubectl rollout status deployment frontend -n mfulearnai --timeout=300s
echo ""

# Step 7: Check new pods
echo -e "${YELLOW}Step 6: New frontend pods:${NC}"
kubectl get pods -n mfulearnai -l app=frontend
echo ""

# Step 8: Show logs from new pods
echo -e "${YELLOW}Step 7: Frontend logs (last 20 lines):${NC}"
kubectl logs -n mfulearnai -l app=frontend --tail=20
echo ""

# Step 9: Verify all services
echo -e "${YELLOW}Step 8: Verifying all services...${NC}"
echo "Frontend:"
kubectl get svc frontend-service -n mfulearnai
echo ""
echo "Chat Service:"
kubectl get svc chat-service -n mfulearnai
echo ""
echo "Auth Service:"
kubectl get svc auth-service -n mfulearnai
echo ""

# Step 10: Check ingress
echo -e "${YELLOW}Step 9: Checking ingress configuration...${NC}"
kubectl get ingress mfulearnai-ingress -n mfulearnai
echo ""

echo -e "${GREEN}=========================================="
echo "✓ Frontend Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Open browser to: https://mfulearnai.mfu.ac.th"
echo "2. Test login flow"
echo "3. Verify user data loads correctly"
echo "4. Test chat functionality"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo "- View logs: kubectl logs -n mfulearnai -l app=frontend -f"
echo "- Check pods: kubectl get pods -n mfulearnai"
echo "- Describe pod: kubectl describe pod <pod-name> -n mfulearnai"
echo ""
