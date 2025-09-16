#!/bin/bash

# MFU Learn AI - Admin Creation Script (Shell Wrapper)
# Usage: ./create_admin.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "🚀 MFU Learn AI - Admin Creation Script"
    echo "======================================"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_dependencies() {
    print_info "Checking dependencies..."

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        print_info "Please install Node.js first:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed!"
        exit 1
    fi

    print_success "Node.js and npm are available"
}

install_dependencies() {
    print_info "Installing Node.js dependencies..."

    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_warning "package.json not found, creating minimal package.json"
        cat > package.json << EOF
{
  "name": "mfu-learn-ai-admin-creator",
  "version": "1.0.0",
  "description": "Admin creation script for MFU Learn AI",
  "main": "create_admin.js",
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
}

run_admin_script() {
    print_info "Running admin creation script..."

    # Check if create_admin.js exists
    if [ ! -f "create_admin.js" ]; then
        print_error "create_admin.js not found!"
        print_info "Please make sure the script file exists in the current directory"
        exit 1
    fi

    # Make the script executable
    chmod +x create_admin.js

    # Run the Node.js script
    node create_admin.js
}

# Main execution
main() {
    print_header

    # Check if we're in the right directory
    if [ ! -f "create_admin.js" ] && [ ! -f "create_admin.sh" ]; then
        print_error "Please run this script from the MFU Learn AI project directory"
        exit 1
    fi

    check_dependencies
    install_dependencies
    run_admin_script
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}👋 Script interrupted by user${NC}"; exit 1' INT

# Show help if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    print_header
    echo "Usage: ./create_admin.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --env-example  Show environment variables example"
    echo ""
    echo "Environment Variables:"
    echo "  MONGODB_URI          MongoDB connection string"
    echo "  ADMIN_USERNAME       Admin username"
    echo "  ADMIN_PASSWORD       Admin password"
    echo "  ADMIN_EMAIL          Admin email"
    echo "  ADMIN_FIRSTNAME      Admin first name"
    echo "  ADMIN_LASTNAME       Admin last name"
    echo "  ADMIN_DEPARTMENT     Admin department"
    echo "  ADMIN_ROLE           Admin role (Admin or SuperAdmin)"
    echo ""
    echo "Examples:"
    echo "  ./create_admin.sh                    # Interactive mode"
    echo "  ADMIN_USERNAME=admin ./create_admin.sh"
    echo "  MONGODB_URI=mongodb://localhost:27017/mydb ./create_admin.sh"
    exit 0
fi

# Show environment variables example
if [ "$1" = "--env-example" ]; then
    print_header
    echo "Environment Variables Example:"
    echo ""
    cat << EOF
# Copy these to your .env file or export them:
export MONGODB_URI="mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your_secure_password"
export ADMIN_EMAIL="admin@mfu.ac.th"
export ADMIN_FIRSTNAME="System"
export ADMIN_LASTNAME="Administrator"
export ADMIN_DEPARTMENT="IT"
export ADMIN_ROLE="SuperAdmin"

# Then run:
./create_admin.sh
EOF
    exit 0
fi

# Run main function
main "$@"