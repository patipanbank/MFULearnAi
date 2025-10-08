#!/bin/bash

###############################################################################
# MFULearnAI Kubernetes Deployment Script
# Usage: ./deploy.sh [--all|--infra|--services|--gateway|--monitoring]
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

    # Check if secrets.yaml exists
    if [ ! -f "secrets.yaml" ]; then
        log_warning "secrets.yaml not found. Please create it from secrets-template.yaml"
        read -p "Continue without secrets? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    log_success "Prerequisites check passed"
}

wait_for_pods() {
    local namespace=$1
    local label=$2
    local timeout=${3:-300}

    log_info "Waiting for pods in namespace $namespace with label $label to be ready..."

    if kubectl wait --for=condition=ready pod -l "$label" -n "$namespace" --timeout="${timeout}s" 2>/dev/null; then
        log_success "Pods are ready"
        return 0
    else
        log_warning "Timeout waiting for pods. They may still be starting..."
        return 1
    fi
}

deploy_namespaces() {
    log_info "Creating namespaces..."
    kubectl apply -f namespaces/namespaces.yaml
    log_success "Namespaces created"
}

deploy_secrets() {
    if [ -f "secrets.yaml" ]; then
        log_info "Applying secrets..."
        kubectl apply -f secrets.yaml
        log_success "Secrets applied"
    else
        log_warning "secrets.yaml not found, skipping secrets deployment"
    fi
}

deploy_configmaps() {
    log_info "Applying ConfigMaps..."
    kubectl apply -f configmaps.yaml
    log_success "ConfigMaps applied"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure components..."

    # MongoDB
    log_info "Deploying MongoDB..."
    kubectl apply -f infrastructure/mongodb/
    wait_for_pods "mfulearnai-core" "app=mongodb" 300

    # Redis
    log_info "Deploying Redis..."
    kubectl apply -f infrastructure/redis/
    wait_for_pods "mfulearnai-core" "app=redis" 180

    # ChromaDB
    log_info "Deploying ChromaDB..."
    kubectl apply -f infrastructure/chromadb/
    wait_for_pods "mfulearnai-core" "app=chromadb" 180

    # MinIO
    log_info "Deploying MinIO..."
    kubectl apply -f infrastructure/minio/
    wait_for_pods "mfulearnai-core" "app=minio" 180

    log_success "Infrastructure deployment completed"

    # Show infrastructure status
    log_info "Infrastructure status:"
    kubectl get pods -n mfulearnai-core
}

deploy_services() {
    log_info "Deploying microservices..."

    # Auth Service
    log_info "Deploying Auth Service..."
    kubectl apply -f services/auth-service/

    # Department Service
    log_info "Deploying Department Service..."
    kubectl apply -f services/department-service/

    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10

    log_success "Services deployment completed"

    # Show services status
    log_info "Services status:"
    kubectl get pods -n mfulearnai-services
    kubectl get svc -n mfulearnai-services
}

deploy_gateway() {
    log_info "Deploying API Gateway and Ingress..."

    # API Gateway
    log_info "Deploying API Gateway..."
    kubectl apply -f gateway/api-gateway/
    wait_for_pods "mfulearnai-gateway" "app=api-gateway" 180

    # Ingress
    log_info "Deploying Ingress..."
    kubectl apply -f gateway/ingress/

    log_success "Gateway deployment completed"

    # Show gateway status
    log_info "Gateway status:"
    kubectl get pods -n mfulearnai-gateway
    kubectl get ingress -n mfulearnai-gateway
}

deploy_monitoring() {
    log_info "Deploying monitoring stack..."

    # Exporters
    log_info "Deploying exporters..."
    kubectl apply -f monitoring/mongodb-exporter.yaml
    kubectl apply -f monitoring/redis-exporter.yaml

    # Prometheus
    log_info "Deploying Prometheus..."
    kubectl apply -f monitoring/prometheus/
    wait_for_pods "mfulearnai-monitoring" "app=prometheus" 180

    # Grafana
    log_info "Deploying Grafana..."
    kubectl apply -f monitoring/grafana/
    wait_for_pods "mfulearnai-monitoring" "app=grafana" 180

    log_success "Monitoring deployment completed"

    # Show monitoring status
    log_info "Monitoring status:"
    kubectl get pods -n mfulearnai-monitoring
}

show_summary() {
    echo ""
    log_info "======================================"
    log_info "Deployment Summary"
    log_info "======================================"
    echo ""

    log_info "Namespaces:"
    kubectl get namespaces | grep mfulearnai
    echo ""

    log_info "Pods by namespace:"
    kubectl get pods --all-namespaces | grep mfulearnai
    echo ""

    log_info "Services:"
    kubectl get svc --all-namespaces | grep mfulearnai
    echo ""

    log_info "Ingress:"
    kubectl get ingress -n mfulearnai-gateway
    echo ""

    log_info "PVCs:"
    kubectl get pvc -n mfulearnai-core
    kubectl get pvc -n mfulearnai-monitoring
    echo ""

    log_success "Deployment completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "  1. Check pod status: kubectl get pods --all-namespaces | grep mfulearnai"
    echo "  2. View logs: kubectl logs -f deployment/<name> -n <namespace>"
    echo "  3. Access Grafana: kubectl port-forward -n mfulearnai-monitoring svc/grafana 3000:3000"
    echo "  4. Check ingress IP: kubectl get ingress -n mfulearnai-gateway"
}

# Main deployment logic
main() {
    local deploy_type=${1:-"--all"}

    echo ""
    log_info "======================================"
    log_info "MFULearnAI Kubernetes Deployment"
    log_info "======================================"
    echo ""

    check_prerequisites

    case $deploy_type in
        --all)
            deploy_namespaces
            deploy_secrets
            deploy_configmaps
            deploy_infrastructure
            deploy_services
            deploy_gateway
            deploy_monitoring
            show_summary
            ;;
        --infra)
            deploy_namespaces
            deploy_secrets
            deploy_infrastructure
            ;;
        --services)
            deploy_configmaps
            deploy_services
            ;;
        --gateway)
            deploy_gateway
            ;;
        --monitoring)
            deploy_monitoring
            ;;
        *)
            log_error "Unknown option: $deploy_type"
            echo "Usage: $0 [--all|--infra|--services|--gateway|--monitoring]"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
