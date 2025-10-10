#!/bin/bash

# Deploy all microservices to Kubernetes
# Run this script on the remote server: ssh mfulearnai@10.1.44.204

set -e

echo "🚀 Starting deployment of all microservices..."
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="mfulearnai"
VERSION="v1.0.0"
NAMESPACE_CORE="mfulearnai-core"
NAMESPACE_SERVICES="mfulearnai-services"
NAMESPACE_GATEWAY="mfulearnai-gateway"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build Docker image
build_service() {
    local service_path=$1
    local service_name=$2
    local image_name="${REGISTRY}/${service_name}:${VERSION}"

    print_status "Building ${service_name}..."
    cd "${service_path}"

    if [ -f "Dockerfile" ]; then
        docker build -t "${image_name}" . || {
            print_error "Failed to build ${service_name}"
            return 1
        }
        print_success "Built ${image_name}"
    else
        print_warning "No Dockerfile found for ${service_name}"
        return 1
    fi

    cd - > /dev/null
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

print_status "Project root: ${PROJECT_ROOT}"
print_status "Script directory: ${SCRIPT_DIR}"

# Step 1: Build all Docker images
echo ""
echo "================================================"
echo "📦 Step 1: Building Docker Images"
echo "================================================"

cd "${PROJECT_ROOT}"

# Build TypeScript services
build_service "k8s/services/department-service" "department-service"
build_service "k8s/services/auth-service" "auth-service"
build_service "k8s/services/storage-service" "storage-service"
build_service "k8s/services/rag-service" "rag-service"
build_service "k8s/services/agent-service" "agent-service"
build_service "k8s/services/training-service" "training-service"
build_service "k8s/services/chat-service" "chat-service"

# Build API Gateway
build_service "k8s/gateway/api-gateway" "api-gateway"

print_success "All Docker images built successfully!"

# Step 2: Create namespaces
echo ""
echo "================================================"
echo "📁 Step 2: Creating Kubernetes Namespaces"
echo "================================================"

kubectl create namespace ${NAMESPACE_CORE} --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace ${NAMESPACE_SERVICES} --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace ${NAMESPACE_GATEWAY} --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace mfulearnai-monitoring --dry-run=client -o yaml | kubectl apply -f -

print_success "Namespaces created/verified"

# Step 3: Deploy infrastructure (MongoDB, Redis, ChromaDB, MinIO)
echo ""
echo "================================================"
echo "🏗️  Step 3: Deploying Infrastructure"
echo "================================================"

cd "${SCRIPT_DIR}"

print_status "Deploying MongoDB..."
kubectl apply -f infrastructure/mongodb/

print_status "Deploying Redis..."
kubectl apply -f infrastructure/redis/

print_status "Deploying ChromaDB..."
kubectl apply -f infrastructure/chromadb/

print_status "Deploying MinIO..."
kubectl apply -f infrastructure/minio/

print_success "Infrastructure deployed"

# Wait for infrastructure to be ready
print_status "Waiting for infrastructure pods to be ready..."
kubectl wait --for=condition=ready pod -l app=mongodb -n ${NAMESPACE_CORE} --timeout=300s || print_warning "MongoDB not ready yet"
kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE_CORE} --timeout=300s || print_warning "Redis not ready yet"
kubectl wait --for=condition=ready pod -l app=chromadb -n ${NAMESPACE_CORE} --timeout=300s || print_warning "ChromaDB not ready yet"
kubectl wait --for=condition=ready pod -l app=minio -n ${NAMESPACE_CORE} --timeout=300s || print_warning "MinIO not ready yet"

# Step 4: Deploy microservices
echo ""
echo "================================================"
echo "🚀 Step 4: Deploying Microservices"
echo "================================================"

print_status "Deploying Department Service..."
kubectl apply -f services/department-service/deployment.yaml

print_status "Deploying Auth Service..."
kubectl apply -f services/auth-service/

print_status "Deploying Storage Service..."
kubectl apply -f services/storage-service/ 2>/dev/null || print_warning "Storage service deployment file not found, skipping"

print_status "Deploying RAG Service..."
kubectl apply -f services/rag-service/ 2>/dev/null || print_warning "RAG service deployment file not found, skipping"

print_status "Deploying Agent Service..."
kubectl apply -f services/agent-service/ 2>/dev/null || print_warning "Agent service deployment file not found, skipping"

print_status "Deploying Training Service..."
kubectl apply -f services/training-service/ 2>/dev/null || print_warning "Training service deployment file not found, skipping"

print_status "Deploying Chat Service..."
kubectl apply -f services/chat-service/ 2>/dev/null || print_warning "Chat service deployment file not found, skipping"

print_success "Microservices deployed"

# Step 5: Deploy API Gateway
echo ""
echo "================================================"
echo "🌐 Step 5: Deploying API Gateway"
echo "================================================"

kubectl apply -f gateway/api-gateway/

print_success "API Gateway deployed"

# Step 6: Deploy Ingress
echo ""
echo "================================================"
echo "🔀 Step 6: Deploying Ingress"
echo "================================================"

kubectl apply -f gateway/ingress/

print_success "Ingress deployed"

# Step 7: Deploy Monitoring (optional)
echo ""
echo "================================================"
echo "📊 Step 7: Deploying Monitoring (Optional)"
echo "================================================"

print_status "Deploying Prometheus..."
kubectl apply -f monitoring/prometheus/

print_status "Deploying Grafana..."
kubectl apply -f monitoring/grafana/

print_status "Deploying Exporters..."
kubectl apply -f monitoring/mongodb-exporter.yaml
kubectl apply -f monitoring/redis-exporter.yaml

print_success "Monitoring deployed"

# Step 8: Verify deployment
echo ""
echo "================================================"
echo "✅ Step 8: Verifying Deployment"
echo "================================================"

print_status "Checking pod status in ${NAMESPACE_CORE}..."
kubectl get pods -n ${NAMESPACE_CORE}

echo ""
print_status "Checking pod status in ${NAMESPACE_SERVICES}..."
kubectl get pods -n ${NAMESPACE_SERVICES}

echo ""
print_status "Checking pod status in ${NAMESPACE_GATEWAY}..."
kubectl get pods -n ${NAMESPACE_GATEWAY}

echo ""
print_status "Checking services..."
kubectl get svc -n ${NAMESPACE_CORE}
kubectl get svc -n ${NAMESPACE_SERVICES}
kubectl get svc -n ${NAMESPACE_GATEWAY}

echo ""
print_status "Checking ingress..."
kubectl get ingress -n ${NAMESPACE_GATEWAY}

echo ""
echo "================================================"
echo "🎉 Deployment Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Wait for all pods to be in 'Running' state:"
echo "   kubectl get pods --all-namespaces | grep mfulearnai"
echo ""
echo "2. Check service logs:"
echo "   kubectl logs -f deployment/api-gateway -n ${NAMESPACE_GATEWAY}"
echo "   kubectl logs -f deployment/chat-service -n ${NAMESPACE_SERVICES}"
echo ""
echo "3. Access the application:"
echo "   https://mfulearnai.mfu.ac.th"
echo ""
echo "4. Check service health:"
echo "   curl http://api-gateway.${NAMESPACE_GATEWAY}.svc.cluster.local:8080/health"
echo ""
