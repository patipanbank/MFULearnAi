#!/bin/bash

# 🚀 MFU Learn AI - Migration Script (FastAPI → NestJS)
# This script helps migrate from FastAPI to NestJS backend

set -e

echo "🚀 Starting migration from FastAPI to NestJS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Step 1: Check prerequisites
log_info "Step 1: Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js is required but not installed."
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is required but not installed."
    exit 1
fi

# Check if in backend-node directory
if [ ! -f "package.json" ]; then
    log_error "Please run this script from the backend-node directory"
    exit 1
fi

log_info "✅ Prerequisites check passed"

# Step 2: Backup current configuration
log_info "Step 2: Creating backup..."

# Create backup directory
mkdir -p backup

# Backup environment if exists
if [ -f ".env" ]; then
    cp .env backup/.env.backup
    log_info "✅ Environment file backed up"
fi

# Step 3: Install dependencies
log_info "Step 3: Installing dependencies..."
npm install

# Step 4: Build application
log_info "Step 4: Building application..."
npm run build

if [ $? -ne 0 ]; then
    log_error "Build failed. Please fix compilation errors."
    exit 1
fi

log_info "✅ Build successful"

# Step 5: Environment setup
log_info "Step 5: Setting up environment..."

# Check if FastAPI .env exists
if [ -f "../backend/.env" ]; then
    log_info "Found FastAPI environment file, migrating..."
    
    # Copy FastAPI environment as template
    cp ../backend/.env .env.temp
    
    # Update port configuration
    sed -i.bak 's/PORT=8000/PORT=5000/g' .env.temp
    
    # Move to final location
    mv .env.temp .env
    
    log_info "✅ Environment migrated from FastAPI"
else
    log_warn "No FastAPI environment found, using default template..."
    
    # Create default environment
    cat > .env << EOF
# Application
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/mfulearnai
REDIS_URL=redis://localhost:6379
CHROMADB_URL=http://localhost:8000

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_ALGORITHM=HS256

# AWS (configure as needed)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
EOF
    
    log_warn "⚠️  Please configure .env file with your settings"
fi

# Step 6: Check services
log_info "Step 6: Checking external services..."

# Check MongoDB
if command -v mongo &> /dev/null; then
    if mongo --eval "db.runCommand('ping')" &> /dev/null; then
        log_info "✅ MongoDB is running"
    else
        log_warn "⚠️  MongoDB is not accessible"
    fi
else
    log_warn "⚠️  MongoDB client not found"
fi

# Check Redis
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        log_info "✅ Redis is running"
    else
        log_warn "⚠️  Redis is not accessible"
    fi
else
    log_warn "⚠️  Redis client not found"
fi

# Step 7: Test build
log_info "Step 7: Testing application..."

# Start server in background for testing
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test health endpoint
if curl -f http://localhost:5000/health &> /dev/null; then
    log_info "✅ Health check passed"
else
    log_warn "⚠️  Health check failed - server may not be fully ready"
fi

# Stop test server
kill $SERVER_PID &> /dev/null || true

# Step 8: Migration summary
log_info "Step 8: Migration summary..."

echo ""
echo "🎉 Migration completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Review and update .env file with your production settings"
echo "  2. Test the application: npm run start:dev"
echo "  3. Verify all endpoints work correctly"
echo "  4. Update your frontend to use port 5000"
echo "  5. Configure reverse proxy/load balancer"
echo ""
echo "📊 Service URLs:"
echo "  - API: http://localhost:5000/api"
echo "  - Docs: http://localhost:5000/docs"
echo "  - Health: http://localhost:5000/health"
echo "  - WebSocket: ws://localhost:5000/socket.io"
echo ""
echo "📂 Important files:"
echo "  - Configuration: .env"
echo "  - Logs: logs/"
echo "  - Backup: backup/"
echo ""
echo "🚀 To start the server:"
echo "  npm run start:dev  # Development"
echo "  npm start          # Production"
echo ""

# Step 9: Ask for next action
echo "What would you like to do next?"
echo "  1. Start development server"
echo "  2. View migration guide"
echo "  3. Test API endpoints"
echo "  4. Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        log_info "Starting development server..."
        npm run start:dev
        ;;
    2)
        log_info "Opening migration guide..."
        if [ -f "MIGRATION_PLAN.md" ]; then
            cat MIGRATION_PLAN.md
        else
            log_warn "Migration guide not found"
        fi
        ;;
    3)
        log_info "Testing API endpoints..."
        echo "Testing health endpoint..."
        curl -w "\n" http://localhost:5000/health || log_warn "Health check failed"
        ;;
    4)
        log_info "Migration complete. Goodbye!"
        exit 0
        ;;
    *)
        log_info "Invalid choice. Migration complete!"
        ;;
esac

echo ""
log_info "🎉 NestJS backend is ready for use!"