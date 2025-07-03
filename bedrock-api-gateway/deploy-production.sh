#!/bin/bash

# =============================================================================
# AWS Bedrock API Gateway - Production Deployment Script
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
BACKUP_DIR="${SCRIPT_DIR}/backups"
LOG_FILE="${SCRIPT_DIR}/deployment.log"

# Functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}INFO: $1${NC}" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if running as root (not recommended)
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root is not recommended for production deployment."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file not found: $ENV_FILE"
        info "Please copy production-env.example to .env and configure it."
        exit 1
    fi
    
    success "Prerequisites check passed"
}

validate_environment() {
    log "Validating environment configuration..."
    
    # Source environment file
    source "$ENV_FILE"
    
    # Check required variables
    local required_vars=(
        "API_KEYS"
        "SECRET_KEY"
        "AWS_REGION"
        "AWS_ACCESS_KEY_ID"
        "AWS_SECRET_ACCESS_KEY"
        "REDIS_PASSWORD"
        "MONGODB_USERNAME"
        "MONGODB_PASSWORD"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    # Check for default values that should be changed
    if [[ "$SECRET_KEY" == "your-super-secret-key-change-this-for-production" ]]; then
        error "SECRET_KEY is still set to default value. Please change it."
    fi
    
    if [[ "$API_KEYS" == "your-api-key-1,your-api-key-2,your-api-key-3" ]]; then
        error "API_KEYS are still set to default values. Please change them."
    fi
    
    success "Environment validation passed"
}

create_directories() {
    log "Creating necessary directories..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Create SSL directory
    mkdir -p "${SCRIPT_DIR}/ssl"
    
    # Create log directory
    mkdir -p "${SCRIPT_DIR}/logs"
    
    # Create data directories for volumes
    mkdir -p "${SCRIPT_DIR}/data/mongodb"
    mkdir -p "${SCRIPT_DIR}/data/redis"
    
    success "Directories created"
}

backup_existing_data() {
    log "Checking for existing data to backup..."
    
    # Check if MongoDB container exists and is running
    if docker ps -a --format "table {{.Names}}" | grep -q "bedrock-mongodb"; then
        log "MongoDB container found, creating backup..."
        
        # Create backup filename with timestamp
        local backup_file="mongodb_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        
        # Create MongoDB backup
        docker exec bedrock-mongodb mongodump --out /tmp/backup --db bedrock_gateway
        docker cp bedrock-mongodb:/tmp/backup "$BACKUP_DIR/$backup_file"
        
        success "MongoDB backup created: $backup_file"
    fi
    
    # Check if Redis container exists and is running
    if docker ps -a --format "table {{.Names}}" | grep -q "bedrock-redis"; then
        log "Redis container found, creating backup..."
        
        local backup_file="redis_backup_$(date +%Y%m%d_%H%M%S).rdb"
        docker exec bedrock-redis redis-cli --rdb /tmp/backup.rdb
        docker cp bedrock-redis:/tmp/backup.rdb "$BACKUP_DIR/$backup_file"
        
        success "Redis backup created: $backup_file"
    fi
}

setup_ssl() {
    log "Setting up SSL certificates..."
    
    if [[ -f "${SCRIPT_DIR}/ssl/bedrock-gateway.crt" && -f "${SCRIPT_DIR}/ssl/bedrock-gateway.key" ]]; then
        success "SSL certificates already exist"
        return
    fi
    
    info "SSL certificates not found. Setting up self-signed certificates..."
    
    # Generate self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${SCRIPT_DIR}/ssl/bedrock-gateway.key" \
        -out "${SCRIPT_DIR}/ssl/bedrock-gateway.crt" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=bedrock-gateway.local"
    
    success "Self-signed SSL certificate generated"
    warning "For production use, replace with proper SSL certificates"
}

deploy_services() {
    log "Deploying services..."
    
    # Build and deploy with production configuration
    docker-compose -f docker-compose.prod.yml up -d --build
    
    success "Services deployed"
}

wait_for_services() {
    log "Waiting for services to be ready..."
    
    # Wait for MongoDB
    log "Waiting for MongoDB..."
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if docker exec bedrock-mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null; then
            success "MongoDB is ready"
            break
        fi
        
        ((attempt++))
        sleep 5
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "MongoDB failed to start within timeout"
    fi
    
    # Wait for Redis
    log "Waiting for Redis..."
    attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if docker exec bedrock-redis redis-cli ping &>/dev/null; then
            success "Redis is ready"
            break
        fi
        
        ((attempt++))
        sleep 5
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "Redis failed to start within timeout"
    fi
    
    # Wait for API Gateway
    log "Waiting for API Gateway..."
    attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f -s http://localhost:8000/health &>/dev/null; then
            success "API Gateway is ready"
            break
        fi
        
        ((attempt++))
        sleep 5
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "API Gateway failed to start within timeout"
    fi
}

run_health_checks() {
    log "Running comprehensive health checks..."
    
    # Check API Gateway health
    local health_response=$(curl -s http://localhost:8000/health)
    if [[ $? -eq 0 ]]; then
        success "API Gateway health check passed"
    else
        error "API Gateway health check failed"
    fi
    
    # Check if all services are running
    local services=("bedrock-api-gateway" "bedrock-mongodb" "bedrock-redis" "bedrock-nginx")
    
    for service in "${services[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$service"; then
            success "Service $service is running"
        else
            error "Service $service is not running"
        fi
    done
    
    # Check API functionality
    info "Testing API functionality..."
    
    # Test models endpoint
    local models_response=$(curl -s -H "X-API-Key: $(echo "$API_KEYS" | cut -d',' -f1)" http://localhost:8000/api/v1/models)
    if [[ $? -eq 0 ]]; then
        success "Models endpoint is working"
    else
        warning "Models endpoint test failed"
    fi
}

setup_monitoring() {
    log "Setting up monitoring (optional)..."
    
    # Deploy monitoring stack if requested
    read -p "Do you want to deploy monitoring stack (Prometheus, Grafana)? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose -f docker-compose.prod.yml --profile monitoring up -d
        success "Monitoring stack deployed"
        info "Grafana available at: http://localhost:3000"
        info "Prometheus available at: http://localhost:9090"
    fi
}

display_deployment_info() {
    log "Deployment completed successfully!"
    
    echo
    echo "==============================================================================="
    echo "AWS Bedrock API Gateway - Production Deployment Complete"
    echo "==============================================================================="
    echo
    echo "Services:"
    echo "  - API Gateway: http://localhost:8000"
    echo "  - API Gateway (HTTPS): https://localhost:443"
    echo "  - API Documentation: http://localhost:8000/docs"
    echo "  - Health Check: http://localhost:8000/health"
    echo
    echo "Database Services:"
    echo "  - MongoDB: mongodb://localhost:27017"
    echo "  - Redis: redis://localhost:6379"
    echo
    echo "Service Status:"
    docker-compose -f docker-compose.prod.yml ps
    echo
    echo "Next Steps:"
    echo "1. Test the API endpoints"
    echo "2. Configure proper SSL certificates for production"
    echo "3. Set up monitoring and alerting"
    echo "4. Configure backup schedules"
    echo "5. Review security settings"
    echo
    echo "Useful Commands:"
    echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  Stop services: docker-compose -f docker-compose.prod.yml down"
    echo "  Update services: docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d"
    echo
    echo "==============================================================================="
}

main() {
    log "Starting production deployment of AWS Bedrock API Gateway"
    
    check_prerequisites
    validate_environment
    create_directories
    backup_existing_data
    setup_ssl
    deploy_services
    wait_for_services
    run_health_checks
    setup_monitoring
    display_deployment_info
    
    success "Production deployment completed successfully!"
}

# Handle script termination
trap 'error "Deployment interrupted"' INT TERM

# Run main function
main "$@" 