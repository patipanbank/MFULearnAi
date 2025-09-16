#!/bin/bash

# MFU Learn AI - Production Admin Creation Script
# Usage: ./create_admin_production.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "🚀 MFU Learn AI - Production Admin Creation Script"
    echo "================================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        print_error ".env file not found in current directory!"
        print_info "Please ensure you're running this script from the project root directory"
        print_info "Expected file: $(pwd)/.env"
        exit 1
    fi
    print_success ".env file found"
}

# Extract MongoDB URI from docker-compose.yml or .env
get_mongodb_uri() {
    print_info "Detecting MongoDB configuration..."

    # Try to extract from docker-compose.yml first
    if [ -f "docker-compose.yml" ]; then
        MONGODB_URI=$(grep "MONGODB_URI=" docker-compose.yml | head -1 | cut -d'=' -f2- | sed 's/^[ \t]*//' | sed 's/[ \t]*$//')
        if [ ! -z "$MONGODB_URI" ]; then
            print_success "Found MongoDB URI from docker-compose.yml"
            export MONGODB_URI
            return 0
        fi
    fi

    # Try to extract from .env file
    if [ -f ".env" ]; then
        MONGODB_URI=$(grep "^MONGODB_URI=" .env | head -1 | cut -d'=' -f2-)
        if [ ! -z "$MONGODB_URI" ]; then
            print_success "Found MongoDB URI from .env"
            export MONGODB_URI
            return 0
        fi
    fi

    # Default MongoDB URI for production
    export MONGODB_URI="mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin"
    print_warning "Using default MongoDB URI: $MONGODB_URI"
}

# Set production environment variables
set_production_env() {
    print_info "Setting up production environment variables..."

    # Load JWT secret from .env if available
    if [ -f ".env" ]; then
        JWT_SECRET=$(grep "^JWT_SECRET=" .env | head -1 | cut -d'=' -f2-)
        if [ ! -z "$JWT_SECRET" ]; then
            export JWT_SECRET
            print_success "JWT_SECRET loaded from .env"
        fi

        # Load AWS region
        AWS_REGION=$(grep "^AWS_REGION=" .env | head -1 | cut -d'=' -f2-)
        if [ ! -z "$AWS_REGION" ]; then
            export AWS_REGION
            print_success "AWS_REGION loaded from .env"
        fi
    fi
}

# Suggest admin credentials based on environment
suggest_admin_creds() {
    print_info "Suggested admin configuration for production:"
    echo ""
    echo -e "${YELLOW}Suggested values:${NC}"
    echo "  Username: superadmin"
    echo "  Email: superadmin@mfu.ac.th"
    echo "  Department: IT"
    echo "  Role: SuperAdmin"
    echo ""
    echo -e "${YELLOW}Security recommendations:${NC}"
    echo "  • Use a strong password (min 12 characters)"
    echo "  • Include uppercase, lowercase, numbers, and symbols"
    echo "  • Don't use common passwords or dictionary words"
    echo ""
}

# Install dependencies if needed
install_deps() {
    print_info "Checking Node.js dependencies..."

    # Check if node_modules exists and has required packages
    if [ ! -d "node_modules" ] || [ ! -d "node_modules/mongoose" ] || [ ! -d "node_modules/bcryptjs" ]; then
        print_info "Installing required dependencies..."

        # Create package.json if it doesn't exist
        if [ ! -f "package.json" ]; then
            print_info "Creating package.json..."
            cat > package.json << EOF
{
  "name": "mfu-learn-ai-admin-creator",
  "version": "1.0.0",
  "description": "Admin creation script for MFU Learn AI",
  "main": "create_admin.js",
  "scripts": {
    "create-admin": "node create_admin.js"
  },
  "dependencies": {
    "mongoose": "^7.0.0",
    "bcryptjs": "^2.4.3"
  }
}
EOF
        fi

        # Install dependencies
        npm install mongoose bcryptjs
        print_success "Dependencies installed"
    else
        print_success "Dependencies already installed"
    fi
}

# Run the admin creation script
run_admin_creation() {
    print_info "Running admin creation script..."

    # Make sure the script is executable
    chmod +x create_admin.js 2>/dev/null || true

    # Run with Node.js
    node create_admin.js
}

# Main execution
main() {
    print_header

    # Pre-flight checks
    check_env_file
    get_mongodb_uri
    set_production_env
    suggest_admin_creds

    # Ask for confirmation
    echo -e "${YELLOW}Do you want to continue with admin creation? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_info "Admin creation cancelled by user"
        exit 0
    fi

    # Setup and run
    install_deps
    run_admin_creation
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}👋 Script interrupted by user${NC}"; exit 1' INT

# Show help if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    print_header
    echo "Production Admin Creation Script for MFU Learn AI"
    echo ""
    echo "This script automatically:"
    echo "  • Loads configuration from your existing .env file"
    echo "  • Detects MongoDB URI from docker-compose.yml or .env"
    echo "  • Sets up production environment variables"
    echo "  • Installs required Node.js dependencies"
    echo "  • Runs the admin creation process"
    echo ""
    echo "Usage: ./create_admin_production.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --check        Check current environment setup"
    echo ""
    echo "Prerequisites:"
    echo "  • Run from the project root directory (where .env exists)"
    echo "  • MongoDB should be accessible"
    echo "  • Node.js and npm should be installed"
    echo ""
    echo "Examples:"
    echo "  ./create_admin_production.sh          # Interactive admin creation"
    echo "  ./create_admin_production.sh --check  # Check environment"
    exit 0
fi

# Check environment setup
if [ "$1" = "--check" ]; then
    print_header
    print_info "Checking production environment setup..."

    echo -e "\n${BLUE}Environment Files:${NC}"
    [ -f ".env" ] && print_success ".env file exists" || print_error ".env file missing"
    [ -f "docker-compose.yml" ] && print_success "docker-compose.yml exists" || print_warning "docker-compose.yml not found"
    [ -f "create_admin.js" ] && print_success "create_admin.js exists" || print_error "create_admin.js missing"

    echo -e "\n${BLUE}Node.js Environment:${NC}"
    command -v node >/dev/null && print_success "Node.js: $(node --version)" || print_error "Node.js not found"
    command -v npm >/dev/null && print_success "npm: $(npm --version)" || print_error "npm not found"

    echo -e "\n${BLUE}Dependencies:${NC}"
    [ -d "node_modules/mongoose" ] && print_success "mongoose installed" || print_warning "mongoose not installed"
    [ -d "node_modules/bcryptjs" ] && print_success "bcryptjs installed" || print_warning "bcryptjs not installed"

    echo -e "\n${BLUE}MongoDB Configuration:${NC}"
    get_mongodb_uri
    echo "  Detected URI: $MONGODB_URI"

    if [ -f ".env" ]; then
        echo -e "\n${BLUE}Production Environment Variables:${NC}"
        grep -E "^(APP_ENV|JWT_SECRET|AWS_REGION|NGINX_SERVER_NAME)" .env | head -5 | while read line; do
            key=$(echo "$line" | cut -d'=' -f1)
            echo "  ✅ $key is configured"
        done
    fi

    exit 0
fi

# Run main function
main "$@"