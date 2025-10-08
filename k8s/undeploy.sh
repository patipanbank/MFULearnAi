#!/bin/bash

###############################################################################
# MFULearnAI Kubernetes Undeployment Script
# Usage: ./undeploy.sh [--all|--services|--gateway|--monitoring|--infra]
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

confirm_action() {
    local message=$1
    log_warning "$message"
    read -p "Are you sure? (yes/NO) " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Aborted by user"
        exit 0
    fi
}

undeploy_monitoring() {
    log_info "Removing monitoring stack..."
    kubectl delete -f monitoring/grafana/ --ignore-not-found=true
    kubectl delete -f monitoring/prometheus/ --ignore-not-found=true
    kubectl delete -f monitoring/redis-exporter.yaml --ignore-not-found=true
    kubectl delete -f monitoring/mongodb-exporter.yaml --ignore-not-found=true
    log_success "Monitoring stack removed"
}

undeploy_gateway() {
    log_info "Removing API Gateway and Ingress..."
    kubectl delete -f gateway/ingress/ --ignore-not-found=true
    kubectl delete -f gateway/api-gateway/ --ignore-not-found=true
    log_success "Gateway removed"
}

undeploy_services() {
    log_info "Removing microservices..."
    kubectl delete -f services/auth-service/ --ignore-not-found=true
    kubectl delete -f services/department-service/ --ignore-not-found=true
    log_success "Services removed"
}

undeploy_infrastructure() {
    log_warning "This will delete infrastructure components and their data!"
    confirm_action "All data in MongoDB, Redis, ChromaDB, and MinIO will be lost!"

    log_info "Removing infrastructure..."
    kubectl delete -f infrastructure/minio/ --ignore-not-found=true
    kubectl delete -f infrastructure/chromadb/ --ignore-not-found=true
    kubectl delete -f infrastructure/redis/ --ignore-not-found=true
    kubectl delete -f infrastructure/mongodb/ --ignore-not-found=true
    log_success "Infrastructure removed"
}

undeploy_config() {
    log_info "Removing ConfigMaps..."
    kubectl delete -f configmaps.yaml --ignore-not-found=true
    log_success "ConfigMaps removed"
}

undeploy_secrets() {
    log_warning "Removing secrets..."
    if [ -f "secrets.yaml" ]; then
        kubectl delete -f secrets.yaml --ignore-not-found=true
    else
        log_info "secrets.yaml not found, skipping"
    fi
    log_success "Secrets removed"
}

undeploy_namespaces() {
    log_warning "This will delete all namespaces and their contents!"
    confirm_action "All resources in mfulearnai-* namespaces will be deleted!"

    log_info "Removing namespaces..."
    kubectl delete -f namespaces/namespaces.yaml --ignore-not-found=true

    log_info "Waiting for namespaces to be deleted..."
    kubectl wait --for=delete namespace/mfulearnai-core --timeout=300s 2>/dev/null || true
    kubectl wait --for=delete namespace/mfulearnai-services --timeout=300s 2>/dev/null || true
    kubectl wait --for=delete namespace/mfulearnai-gateway --timeout=300s 2>/dev/null || true
    kubectl wait --for=delete namespace/mfulearnai-monitoring --timeout=300s 2>/dev/null || true

    log_success "Namespaces removed"
}

delete_pvcs() {
    log_warning "Deleting PersistentVolumeClaims..."
    confirm_action "All stored data will be permanently deleted!"

    kubectl delete pvc --all -n mfulearnai-core --ignore-not-found=true
    kubectl delete pvc --all -n mfulearnai-monitoring --ignore-not-found=true

    log_success "PVCs deleted"
}

show_remaining_resources() {
    echo ""
    log_info "Checking for remaining resources..."

    local namespaces=$(kubectl get namespaces | grep mfulearnai | wc -l)
    if [ "$namespaces" -eq 0 ]; then
        log_success "All mfulearnai namespaces have been deleted"
    else
        log_warning "Some namespaces still exist:"
        kubectl get namespaces | grep mfulearnai
    fi

    local pvcs=$(kubectl get pvc --all-namespaces | grep mfulearnai | wc -l)
    if [ "$pvcs" -eq 0 ]; then
        log_success "All PVCs have been deleted"
    else
        log_warning "Some PVCs still exist:"
        kubectl get pvc --all-namespaces | grep mfulearnai
    fi

    local pvs=$(kubectl get pv | grep mfulearnai | wc -l)
    if [ "$pvs" -eq 0 ]; then
        log_success "All PVs have been deleted"
    else
        log_warning "Some PVs still exist (they should be auto-deleted):"
        kubectl get pv | grep mfulearnai
    fi
}

# Main undeployment logic
main() {
    local undeploy_type=${1:-"--all"}

    echo ""
    log_info "======================================"
    log_info "MFULearnAI Kubernetes Undeployment"
    log_info "======================================"
    echo ""

    case $undeploy_type in
        --all)
            confirm_action "This will remove ALL MFULearnAI resources including data!"
            undeploy_monitoring
            undeploy_gateway
            undeploy_services
            undeploy_infrastructure
            undeploy_config
            undeploy_secrets
            delete_pvcs
            undeploy_namespaces
            show_remaining_resources
            log_success "Complete undeployment finished"
            ;;
        --monitoring)
            undeploy_monitoring
            ;;
        --gateway)
            undeploy_gateway
            ;;
        --services)
            undeploy_services
            ;;
        --infra)
            undeploy_infrastructure
            ;;
        --config)
            undeploy_config
            undeploy_secrets
            ;;
        *)
            log_error "Unknown option: $undeploy_type"
            echo "Usage: $0 [--all|--services|--gateway|--monitoring|--infra|--config]"
            exit 1
            ;;
    esac

    echo ""
    log_info "Undeployment completed"
}

# Run main function
main "$@"
