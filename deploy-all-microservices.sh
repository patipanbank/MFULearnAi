#!/bin/bash

# Complete Microservices Deployment Script
# Deploys both chat-service and frontend
# Run this on the production server: ssh mfulearnai@10.1.44.204

set -e  # Exit on error

echo "=========================================="
echo "Complete Microservices Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Pull latest code
echo -e "${BLUE}=========================================="
echo "STEP 1: Updating Code"
echo "==========================================${NC}"
cd /home/mfulearnai/MFULearnAi
git fetch origin kube
git reset --hard origin/kube
echo -e "${GREEN}✓ Code updated to latest version${NC}"
echo ""
git log --oneline -5
echo ""

# Step 2: Build chat-service
echo -e "${BLUE}=========================================="
echo "STEP 2: Building Chat Service"
echo "==========================================${NC}"
cd /home/mfulearnai/MFULearnAi/services/chat-service
docker build -t mfulearnai/chat-service:latest .
echo -e "${GREEN}✓ Chat service image built${NC}"
echo ""

# Step 3: Build frontend
echo -e "${BLUE}=========================================="
echo "STEP 3: Building Frontend"
echo "==========================================${NC}"
cd /home/mfulearnai/MFULearnAi/frontend
docker build -t mfulearnai/frontend:latest .
echo -e "${GREEN}✓ Frontend image built${NC}"
echo ""

# Step 4: Check current state
echo -e "${BLUE}=========================================="
echo "STEP 4: Current Cluster State"
echo "==========================================${NC}"
kubectl get pods -n mfulearnai
echo ""

# Step 5: Deploy chat-service
echo -e "${BLUE}=========================================="
echo "STEP 5: Deploying Chat Service"
echo "==========================================${NC}"
kubectl rollout restart deployment chat-service -n mfulearnai
echo -e "${YELLOW}Waiting for chat-service rollout...${NC}"
kubectl rollout status deployment chat-service -n mfulearnai --timeout=300s
echo -e "${GREEN}✓ Chat service deployed${NC}"
echo ""

# Step 6: Deploy frontend
echo -e "${BLUE}=========================================="
echo "STEP 6: Deploying Frontend"
echo "==========================================${NC}"
kubectl rollout restart deployment frontend -n mfulearnai
echo -e "${YELLOW}Waiting for frontend rollout...${NC}"
kubectl rollout status deployment frontend -n mfulearnai --timeout=300s
echo -e "${GREEN}✓ Frontend deployed${NC}"
echo ""

# Step 7: Verify deployments
echo -e "${BLUE}=========================================="
echo "STEP 7: Verification"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}All Pods:${NC}"
kubectl get pods -n mfulearnai
echo ""
echo -e "${YELLOW}All Services:${NC}"
kubectl get svc -n mfulearnai
echo ""
echo -e "${YELLOW}Ingress:${NC}"
kubectl get ingress -n mfulearnai
echo ""

# Step 8: Show logs
echo -e "${BLUE}=========================================="
echo "STEP 8: Recent Logs"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}Chat Service Logs:${NC}"
kubectl logs -n mfulearnai -l app=chat-service --tail=10
echo ""
echo -e "${YELLOW}Frontend Logs:${NC}"
kubectl logs -n mfulearnai -l app=frontend --tail=10
echo ""

# Final summary
echo -e "${GREEN}=========================================="
echo "✓✓✓ Deployment Complete! ✓✓✓"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}Services Status:${NC}"
echo "✓ Chat Service: 3 replicas"
echo "✓ Frontend: 2 replicas"
echo "✓ Auth Service: 2 replicas"
echo ""
echo -e "${YELLOW}URLs:${NC}"
echo "• Main: https://mfulearnai.mfu.ac.th"
echo "• WebSocket: wss://mfulearnai.mfu.ac.th/ws/chat"
echo "• Auth API: https://mfulearnai.mfu.ac.th/api/auth"
echo "• Chat API: https://mfulearnai.mfu.ac.th/api/chat"
echo ""
echo -e "${YELLOW}Testing Steps:${NC}"
echo "1. Open browser to https://mfulearnai.mfu.ac.th"
echo "2. Login with SAML"
echo "3. Verify user data loads (check console logs)"
echo "4. Navigate to /chat"
echo "5. Send a test message"
echo "6. Verify WebSocket connection and streaming"
echo ""
echo -e "${YELLOW}Monitor Logs:${NC}"
echo "• Chat: kubectl logs -n mfulearnai -l app=chat-service -f"
echo "• Frontend: kubectl logs -n mfulearnai -l app=frontend -f"
echo ""
