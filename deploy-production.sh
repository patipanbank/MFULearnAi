#!/bin/bash

###############################################################################
# MFULearnAI Production Deployment Script
#
# This script deploys the complete MFULearnAI application to Kubernetes
# on the remote production server (mfulearnai@10.1.44.204)
#
# Usage:
#   1. SSH to remote server: ssh mfulearnai@10.1.44.204
#   2. Clone/pull latest code: git pull origin main
#   3. Run this script: ./deploy-production.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="docker.io/mfulearnai"
VERSION="latest"
NAMESPACE_CORE="mfulearnai-core"
NAMESPACE_SERVICES="mfulearnai-services"
NAMESPACE_GATEWAY="mfulearnai-gateway"
NAMESPACE_MONITORING="mfulearnai-monitoring"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo ""
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log_header "Building Docker Images"

    local services=(
        "k8s/services/auth-service:auth-service"
        "k8s/services/department-service:department-service"
        "k8s/services/storage-service:storage-service"
        "k8s/services/rag-service:rag-service"
        "k8s/services/agent-service:agent-service"
        "k8s/services/training-service:training-service"
        "k8s/services/chat-service:chat-service"
        "k8s/gateway/api-gateway:api-gateway"
    )

    for service in "${services[@]}"; do
        IFS=':' read -r path name <<< "$service"
        log_info "Building ${name}..."

        if [ -f "${path}/Dockerfile" ]; then
            docker build -t "${REGISTRY}/${name}:${VERSION}" "${path}" || {
                log_error "Failed to build ${name}"
                return 1
            }
            log_success "Built ${name}"
        else
            log_warning "No Dockerfile found for ${name}"
        fi
    done

    log_success "All Docker images built successfully"
}

# Create namespaces
create_namespaces() {
    log_header "Creating Namespaces"

    kubectl create namespace ${NAMESPACE_CORE} --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace ${NAMESPACE_SERVICES} --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace ${NAMESPACE_GATEWAY} --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace ${NAMESPACE_MONITORING} --dry-run=client -o yaml | kubectl apply -f -

    log_success "Namespaces created/verified"
}

# Deploy secrets
deploy_secrets() {
    log_header "Deploying Secrets"

    if [ -f "k8s/secrets.yaml" ]; then
        log_info "Applying secrets..."
        kubectl apply -f k8s/secrets.yaml
        log_success "Secrets applied"
    else
        log_warning "k8s/secrets.yaml not found"
        log_warning "Please create secrets.yaml from secrets-template.yaml"
        read -p "Continue without secrets? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Deploy infrastructure
deploy_infrastructure() {
    log_header "Deploying Infrastructure"

    cd k8s

    # MongoDB
    log_info "Deploying MongoDB..."
    kubectl apply -f infrastructure/mongodb/

    # Redis
    log_info "Deploying Redis..."
    kubectl apply -f infrastructure/redis/

    # ChromaDB
    log_info "Deploying ChromaDB..."
    kubectl apply -f infrastructure/chromadb/

    # MinIO
    log_info "Deploying MinIO..."
    kubectl apply -f infrastructure/minio/

    log_success "Infrastructure deployed"

    # Wait for infrastructure
    log_info "Waiting for infrastructure to be ready (this may take 3-5 minutes)..."

    kubectl wait --for=condition=ready pod -l app=mongodb -n ${NAMESPACE_CORE} --timeout=300s || log_warning "MongoDB pods not ready yet"
    kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE_CORE} --timeout=180s || log_warning "Redis pods not ready yet"
    kubectl wait --for=condition=ready pod -l app=chromadb -n ${NAMESPACE_CORE} --timeout=180s || log_warning "ChromaDB pods not ready yet"
    kubectl wait --for=condition=ready pod -l app=minio -n ${NAMESPACE_CORE} --timeout=180s || log_warning "MinIO pods not ready yet"

    cd ..
}

# Deploy microservices
deploy_services() {
    log_header "Deploying Microservices"

    cd k8s

    # Deploy all microservices
    local services=(
        "services/auth-service:Auth Service"
        "services/department-service:Department Service"
        "services/storage-service:Storage Service"
        "services/rag-service:RAG Service"
        "services/agent-service:Agent Service"
        "services/training-service:Training Service"
        "services/chat-service:Chat Service"
    )

    for service in "${services[@]}"; do
        IFS=':' read -r path name <<< "$service"
        log_info "Deploying ${name}..."

        if [ -d "${path}" ]; then
            kubectl apply -f "${path}/" 2>/dev/null || log_warning "${name} deployment failed or not found"
        else
            log_warning "${path} not found"
        fi
    done

    log_success "Microservices deployed"

    cd ..
}

# Deploy API Gateway
deploy_gateway() {
    log_header "Deploying API Gateway & Ingress"

    cd k8s

    # API Gateway
    log_info "Deploying API Gateway..."
    kubectl apply -f gateway/api-gateway/ || log_warning "API Gateway deployment failed"

    # Ingress
    log_info "Deploying Ingress..."
    kubectl apply -f gateway/ingress/ || log_warning "Ingress deployment failed"

    log_success "Gateway deployed"

    cd ..
}

# Deploy monitoring
deploy_monitoring() {
    log_header "Deploying Monitoring Stack"

    cd k8s

    # Exporters
    log_info "Deploying MongoDB Exporter..."
    kubectl apply -f monitoring/mongodb-exporter.yaml 2>/dev/null || log_warning "MongoDB exporter failed"

    log_info "Deploying Redis Exporter..."
    kubectl apply -f monitoring/redis-exporter.yaml 2>/dev/null || log_warning "Redis exporter failed"

    # Prometheus
    log_info "Deploying Prometheus..."
    kubectl apply -f monitoring/prometheus/ || log_warning "Prometheus deployment failed"

    # Grafana
    log_info "Deploying Grafana..."
    kubectl apply -f monitoring/grafana/ || log_warning "Grafana deployment failed"

    log_success "Monitoring deployed"

    cd ..
}

# Verify deployment
verify_deployment() {
    log_header "Verifying Deployment"

    echo ""
    log_info "Pods in ${NAMESPACE_CORE}:"
    kubectl get pods -n ${NAMESPACE_CORE} -o wide

    echo ""
    log_info "Pods in ${NAMESPACE_SERVICES}:"
    kubectl get pods -n ${NAMESPACE_SERVICES} -o wide

    echo ""
    log_info "Pods in ${NAMESPACE_GATEWAY}:"
    kubectl get pods -n ${NAMESPACE_GATEWAY} -o wide

    echo ""
    log_info "Services:"
    kubectl get svc --all-namespaces | grep mfulearnai

    echo ""
    log_info "Ingress:"
    kubectl get ingress -n ${NAMESPACE_GATEWAY}

    echo ""
    log_info "PersistentVolumeClaims:"
    kubectl get pvc -n ${NAMESPACE_CORE}
}

# Show summary and next steps
show_summary() {
    log_header "Deployment Complete!"

    echo ""
    log_success "MFULearnAI has been successfully deployed to Kubernetes"
    echo ""

    log_info "Next Steps:"
    echo ""
    echo "1. Monitor pod status:"
    echo "   kubectl get pods --all-namespaces | grep mfulearnai"
    echo ""
    echo "2. Check service logs:"
    echo "   kubectl logs -f deployment/api-gateway -n ${NAMESPACE_GATEWAY}"
    echo "   kubectl logs -f deployment/chat-service -n ${NAMESPACE_SERVICES}"
    echo ""
    echo "3. Access the application:"
    echo "   https://mfulearnai.mfu.ac.th"
    echo ""
    echo "4. Access Grafana monitoring:"
    echo "   kubectl port-forward -n ${NAMESPACE_MONITORING} svc/grafana 3000:3000"
    echo "   Then visit: http://localhost:3000"
    echo ""
    echo "5. Check service health:"
    echo "   kubectl get pods -n ${NAMESPACE_SERVICES} -w"
    echo ""

    log_warning "IMPORTANT: Make sure to update DNS records to point to the Ingress IP"
    log_info "Get Ingress IP: kubectl get ingress -n ${NAMESPACE_GATEWAY}"
}

# Backup existing deployment
backup_deployment() {
    log_header "Backing Up Existing Deployment"

    local backup_dir="$HOME/mfulearnai-backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"

    log_info "Creating backup in ${backup_dir}..."

    # Export current resources
    kubectl get all -n ${NAMESPACE_CORE} -o yaml > "${backup_dir}/core-backup.yaml" 2>/dev/null || true
    kubectl get all -n ${NAMESPACE_SERVICES} -o yaml > "${backup_dir}/services-backup.yaml" 2>/dev/null || true
    kubectl get all -n ${NAMESPACE_GATEWAY} -o yaml > "${backup_dir}/gateway-backup.yaml" 2>/dev/null || true

    log_success "Backup created at ${backup_dir}"
}

# Main deployment function
main() {
    log_header "MFULearnAI Production Deployment"

    log_info "Starting deployment at $(date)"
    log_info "Target: Kubernetes Cluster"
    echo ""

    # Ask for confirmation
    read -p "This will deploy/update MFULearnAI on production. Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi

    # Run deployment steps
    check_prerequisites
    backup_deployment
    build_images
    create_namespaces
    deploy_secrets
    deploy_infrastructure
    deploy_services
    deploy_gateway
    deploy_monitoring
    verify_deployment
    show_summary

    log_info "Deployment completed at $(date)"
}

# Run main function
main "$@"
