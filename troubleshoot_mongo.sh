#!/bin/bash

# MongoDB Troubleshooting Script for MFU Learn AI
# Usage: ./troubleshoot_mongo.sh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}🔍 MongoDB Connection Troubleshooting${NC}"
    echo "========================================"
    echo ""
}

print_section() {
    echo -e "\n${BLUE}$1${NC}"
    echo "----------------------------------------"
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

# Check Docker services
check_docker() {
    print_section "Docker Services"

    if ! command -v docker >/dev/null; then
        print_error "Docker is not installed or not in PATH"
        return 1
    fi

    print_info "Docker version: $(docker --version)"

    # Check if Docker is running
    if docker ps >/dev/null 2>&1; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running"
        print_info "Try: sudo systemctl start docker"
        return 1
    fi

    # Check running containers
    echo -e "\n${YELLOW}Running containers:${NC}"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

    # Check for MongoDB container specifically
    if docker ps | grep -q mongo; then
        print_success "MongoDB container is running"
        MONGO_CONTAINER=$(docker ps | grep mongo | awk '{print $1}')
        print_info "MongoDB container ID: $MONGO_CONTAINER"
    else
        print_error "MongoDB container is not running"
        print_info "Available containers:"
        docker ps -a | grep mongo || echo "  No MongoDB containers found"
        return 1
    fi
}

# Check MongoDB connection
check_mongodb_connection() {
    print_section "MongoDB Connection Test"

    # Test port 27017
    if command -v nc >/dev/null; then
        if nc -z localhost 27017; then
            print_success "Port 27017 is accessible on localhost"
        else
            print_error "Port 27017 is not accessible on localhost"

            # Check if port is exposed
            print_info "Checking port mapping..."
            docker port $(docker ps | grep mongo | awk '{print $1}') 2>/dev/null || print_warning "No port mapping found"
        fi
    else
        print_warning "netcat (nc) not available for port testing"
    fi

    # Test with MongoDB client if available
    if command -v mongosh >/dev/null; then
        print_info "Testing connection with mongosh..."
        if timeout 10 mongosh "mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin" --eval "db.runCommand('ping')" >/dev/null 2>&1; then
            print_success "MongoDB connection successful with mongosh"
        else
            print_error "MongoDB connection failed with mongosh"
        fi
    elif command -v mongo >/dev/null; then
        print_info "Testing connection with mongo client..."
        if timeout 10 mongo "mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin" --eval "db.runCommand('ping')" >/dev/null 2>&1; then
            print_success "MongoDB connection successful with mongo client"
        else
            print_error "MongoDB connection failed with mongo client"
        fi
    else
        print_warning "MongoDB client not available for testing"
    fi
}

# Check MongoDB logs
check_mongodb_logs() {
    print_section "MongoDB Logs"

    MONGO_CONTAINER=$(docker ps | grep mongo | awk '{print $1}' | head -1)
    if [ -z "$MONGO_CONTAINER" ]; then
        print_error "No running MongoDB container found"
        return 1
    fi

    print_info "Recent MongoDB logs (last 20 lines):"
    echo ""
    docker logs --tail 20 $MONGO_CONTAINER
}

# Check network configuration
check_network() {
    print_section "Network Configuration"

    # Check docker network
    if docker network ls | grep -q mfulearnai; then
        print_success "Docker network 'mfulearnai' exists"
        print_info "Network details:"
        docker network inspect mfulearnai --format '{{json .IPAM.Config}}' | jq '.' 2>/dev/null || docker network inspect mfulearnai | grep -A 5 "IPAM"
    else
        print_warning "Docker network 'mfulearnai' not found"
    fi

    # Check container network settings
    MONGO_CONTAINER=$(docker ps | grep mongo | awk '{print $1}' | head -1)
    if [ ! -z "$MONGO_CONTAINER" ]; then
        print_info "MongoDB container network settings:"
        docker inspect $MONGO_CONTAINER | grep -A 10 "NetworkSettings" | head -15
    fi
}

# Show connection URIs
show_connection_uris() {
    print_section "Connection URI Options"

    echo -e "${YELLOW}For admin script (external access):${NC}"
    echo "  mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin"
    echo ""

    echo -e "${YELLOW}For docker-compose (internal):${NC}"
    echo "  mongodb://root:1234@db:27017/mfu_chatbot?authSource=admin"
    echo ""

    echo -e "${YELLOW}For Node.js app inside container:${NC}"
    echo "  mongodb://root:1234@db:27017/mfu_chatbot?authSource=admin"
    echo ""

    # Get container IP if available
    MONGO_CONTAINER=$(docker ps | grep mongo | awk '{print $1}' | head -1)
    if [ ! -z "$MONGO_CONTAINER" ]; then
        MONGO_IP=$(docker inspect $MONGO_CONTAINER | grep -oP '"IPAddress": "\K[^"]*' | head -1)
        if [ ! -z "$MONGO_IP" ]; then
            echo -e "${YELLOW}Direct container IP access:${NC}"
            echo "  mongodb://root:1234@$MONGO_IP:27017/mfu_chatbot?authSource=admin"
        fi
    fi
}

# Provide solutions
show_solutions() {
    print_section "Common Solutions"

    echo -e "${YELLOW}1. Start MongoDB container:${NC}"
    echo "   docker-compose up -d db"
    echo ""

    echo -e "${YELLOW}2. Restart all services:${NC}"
    echo "   docker-compose down"
    echo "   docker-compose up -d"
    echo ""

    echo -e "${YELLOW}3. Check container status:${NC}"
    echo "   docker ps -a | grep mongo"
    echo "   docker logs mfulearnai_db"
    echo ""

    echo -e "${YELLOW}4. Rebuild if needed:${NC}"
    echo "   docker-compose down -v"
    echo "   docker-compose up -d db"
    echo ""

    echo -e "${YELLOW}5. Test connection manually:${NC}"
    echo "   docker exec -it mfulearnai_db mongosh"
    echo "   # or"
    echo "   mongosh 'mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin'"
    echo ""

    echo -e "${YELLOW}6. For admin creation:${NC}"
    echo "   export MONGODB_URI='mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin'"
    echo "   ./create_admin.sh"
}

# Main function
main() {
    print_header

    # Run all checks
    check_docker
    echo ""
    check_mongodb_connection
    echo ""
    check_mongodb_logs
    echo ""
    check_network
    echo ""
    show_connection_uris
    echo ""
    show_solutions

    print_section "Summary"
    print_info "Troubleshooting completed. Check the results above for issues."
    print_info "If problems persist, try the suggested solutions or contact IT support."
}

# Handle arguments
case "$1" in
    --docker)
        print_header
        check_docker
        ;;
    --connection)
        print_header
        check_mongodb_connection
        ;;
    --logs)
        print_header
        check_mongodb_logs
        ;;
    --network)
        print_header
        check_network
        ;;
    --uris)
        print_header
        show_connection_uris
        ;;
    --solutions)
        print_header
        show_solutions
        ;;
    --help|-h)
        print_header
        echo "MongoDB Troubleshooting Script"
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  --docker       Check Docker services only"
        echo "  --connection   Test MongoDB connection only"
        echo "  --logs         Show MongoDB logs only"
        echo "  --network      Check network configuration"
        echo "  --uris         Show connection URI options"
        echo "  --solutions    Show common solutions"
        echo "  --help, -h     Show this help"
        echo ""
        echo "Run without arguments to perform full troubleshooting."
        ;;
    *)
        main
        ;;
esac