#!/bin/bash

# MFU Learn AI Deployment Script
# For remote server: ssh mfulearnai@10.1.44.204

set -e

echo "====================================="
echo "MFU Learn AI Deployment Script"
echo "====================================="

# Configuration
REMOTE_USER="mfulearnai"
REMOTE_HOST="10.1.44.204"
REMOTE_DIR="/home/mfulearnai/MFULearnAi"
BRANCH="${1:-main}"

echo "📦 Deploying branch: $BRANCH"
echo "🖥️  Remote server: $REMOTE_USER@$REMOTE_HOST"
echo ""

# Function to run commands on remote server
remote_exec() {
    ssh "$REMOTE_USER@$REMOTE_HOST" "$@"
}

# Step 1: Push to Git
echo "🔄 Pushing to Git..."
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || true
git push origin "$BRANCH"

# Step 2: Pull on remote server
echo "📥 Pulling latest code on remote server..."
remote_exec "cd $REMOTE_DIR && git pull origin $BRANCH"

# Step 3: Build and restart containers
echo "🐳 Building and restarting Docker containers..."
remote_exec "cd $REMOTE_DIR && docker-compose down"
remote_exec "cd $REMOTE_DIR && docker-compose build --no-cache backend"
remote_exec "cd $REMOTE_DIR && docker-compose up -d"

# Step 4: Check health
echo "🏥 Checking service health..."
sleep 10
remote_exec "docker-compose -f $REMOTE_DIR/docker-compose.yml ps"

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Backend: http://$REMOTE_HOST:3001"
echo "🌐 Frontend: http://$REMOTE_HOST"
echo ""
echo "To view logs, run:"
echo "  ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_DIR && docker-compose logs -f'"
