#!/bin/bash

# MFU Learn AI Backend Node.js - System Testing Script
# Created: December 21, 2024

echo "🚀 Starting MFU Learn AI Backend Node.js System Test"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5000"
TEST_PASSED=0
TEST_FAILED=0

# Helper function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        ((TEST_PASSED++))
    else
        echo -e "${RED}❌ $2${NC}"
        ((TEST_FAILED++))
    fi
}

# Test 1: Basic Health Check
echo "🏥 Testing Basic Health Check..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/health")
if [ "$response" == "200" ]; then
    print_result 0 "Basic health check"
else
    print_result 1 "Basic health check (HTTP: $response)"
fi

# Test 2: API Documentation
echo "📚 Testing API Documentation..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/docs")
if [ "$response" == "200" ]; then
    print_result 0 "API documentation accessible"
else
    print_result 1 "API documentation (HTTP: $response)"
fi

# Test 3: Authentication Endpoints
echo "🔐 Testing Authentication Endpoints..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/auth/login" -X POST -H "Content-Type: application/json" -d '{}')
if [ "$response" == "400" ] || [ "$response" == "422" ]; then
    print_result 0 "Authentication endpoint responding"
else
    print_result 1 "Authentication endpoint (HTTP: $response)"
fi

# Test 4: Agent System Endpoints
echo "🤖 Testing Agent System Endpoints..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/agents")
if [ "$response" == "401" ]; then
    print_result 0 "Agent system requires authentication"
else
    print_result 1 "Agent system endpoint (HTTP: $response)"
fi

# Test 5: Vector Embeddings Endpoints
echo "🔍 Testing Vector Embeddings Endpoints..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/embeddings/health")
if [ "$response" == "200" ]; then
    print_result 0 "Vector embeddings health check"
else
    print_result 1 "Vector embeddings health (HTTP: $response)"
fi

# Test 6: WebSocket Gateway
echo "🌐 Testing WebSocket Gateway..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/socket.io/")
if [ "$response" == "200" ] || [ "$response" == "400" ]; then
    print_result 0 "WebSocket gateway responding"
else
    print_result 1 "WebSocket gateway (HTTP: $response)"
fi

# Test 7: Chat System
echo "💬 Testing Chat System..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/chat")
if [ "$response" == "401" ]; then
    print_result 0 "Chat system requires authentication"
else
    print_result 1 "Chat system endpoint (HTTP: $response)"
fi

# Test 8: Collections Management
echo "📁 Testing Collections Management..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/collections")
if [ "$response" == "401" ]; then
    print_result 0 "Collections system requires authentication"
else
    print_result 1 "Collections system endpoint (HTTP: $response)"
fi

# Test 9: Upload System
echo "📤 Testing Upload System..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/upload")
if [ "$response" == "401" ]; then
    print_result 0 "Upload system requires authentication"
else
    print_result 1 "Upload system endpoint (HTTP: $response)"
fi

# Test 10: Admin System
echo "👑 Testing Admin System..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/admin")
if [ "$response" == "401" ]; then
    print_result 0 "Admin system requires authentication"
else
    print_result 1 "Admin system endpoint (HTTP: $response)"
fi

# Test 11: Monitoring System
echo "📊 Testing Monitoring System..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/monitoring")
if [ "$response" == "401" ] || [ "$response" == "200" ]; then
    print_result 0 "Monitoring system responding"
else
    print_result 1 "Monitoring system (HTTP: $response)"
fi

# Test 12: System Information
echo "ℹ️ Testing System Information..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/embeddings/info")
if [ "$response" == "401" ]; then
    print_result 0 "System info requires authentication"
else
    print_result 1 "System info endpoint (HTTP: $response)"
fi

# Summary
echo ""
echo "=================================================="
echo "🎯 Test Summary"
echo "=================================================="
echo -e "${GREEN}✅ Passed: $TEST_PASSED${NC}"
echo -e "${RED}❌ Failed: $TEST_FAILED${NC}"
echo -e "📊 Total Tests: $((TEST_PASSED + TEST_FAILED))"

if [ $TEST_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! System is ready for use.${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Please check the system configuration.${NC}"
    exit 1
fi 