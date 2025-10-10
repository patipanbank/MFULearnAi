#!/bin/bash

##############################################################################
# LangGraph Agent Deployment Script
#
# This script deploys the new LangGraph-based agent architecture
# to the production server
##############################################################################

set -e  # Exit on error

echo "🚀 Starting LangGraph Agent Deployment..."
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Pull latest code
echo -e "${BLUE}Step 1/5: Pulling latest code from git...${NC}"
cd /home/mfulearnai/MFULearnAi
git fetch origin kubernetes
git reset --hard origin/kubernetes
echo -e "${GREEN}✓ Code updated to latest version${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${BLUE}Step 2/5: Installing dependencies...${NC}"
cd k8s/services/agent-service
npm install --production
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Build TypeScript
echo -e "${BLUE}Step 3/5: Building TypeScript...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed! Aborting deployment.${NC}"
    exit 1
fi
echo ""

# Step 4: Stop and remove old container
echo -e "${BLUE}Step 4/5: Stopping old agent-service container...${NC}"
cd /home/mfulearnai/MFULearnAi
docker-compose stop agent-service || true
docker-compose rm -f agent-service || true
echo -e "${GREEN}✓ Old container stopped${NC}"
echo ""

# Step 5: Start new container
echo -e "${BLUE}Step 5/5: Starting new agent-service container...${NC}"
docker-compose up -d agent-service

# Wait for container to be healthy
echo -e "${YELLOW}Waiting for service to be healthy...${NC}"
sleep 10

# Check container status
CONTAINER_STATUS=$(docker ps --filter "name=agent-service" --format "{{.Status}}")
if [[ $CONTAINER_STATUS == *"Up"* ]]; then
    echo -e "${GREEN}✓ Agent service is running!${NC}"
else
    echo -e "${RED}✗ Agent service failed to start${NC}"
    echo "Container logs:"
    docker logs agent-service --tail 50
    exit 1
fi
echo ""

# Step 6: Verify deployment
echo -e "${BLUE}Verifying deployment...${NC}"
sleep 5
HEALTH_CHECK=$(docker exec agent-service wget -qO- http://localhost:3003/health || echo "failed")
if [[ $HEALTH_CHECK == *"healthy"* ]]; then
    echo -e "${GREEN}✓ Health check passed!${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Container logs:"
    docker logs agent-service --tail 30
fi
echo ""

# Display summary
echo "=========================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Service Information:"
echo "  - Name: agent-service"
echo "  - Port: 3003"
echo "  - Architecture: LangGraph StateGraph"
echo "  - Status: $(docker ps --filter 'name=agent-service' --format '{{.Status}}')"
echo ""
echo "Useful commands:"
echo "  View logs:    docker logs -f agent-service"
echo "  Check status: docker ps | grep agent-service"
echo "  Restart:      docker-compose restart agent-service"
echo "  Health check: curl http://localhost:3003/health"
echo ""
echo -e "${YELLOW}📋 Latest changes:${NC}"
echo "  ✓ LangGraph StateGraph implementation"
echo "  ✓ Native streaming support"
echo "  ✓ Improved state management with checkpointer"
echo "  ✓ Conditional routing (Router → RAG/Web → Agent)"
echo "  ✓ Better debugging and monitoring"
echo ""
