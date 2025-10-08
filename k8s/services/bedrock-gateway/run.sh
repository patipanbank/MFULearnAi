#!/bin/bash

# AWS Bedrock API Gateway Run Script

echo "🚀 Starting AWS Bedrock API Gateway..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📋 Please copy .env.example to .env and configure your settings:"
    echo "   cp .env.example .env"
    echo "   nano .env"
    echo ""
    echo "🔑 Required environment variables:"
    echo "   - AWS_REGION"
    echo "   - AWS_ACCESS_KEY_ID"
    echo "   - AWS_SECRET_ACCESS_KEY"
    echo "   - API_KEYS"
    echo ""
    read -p "Do you want to continue without .env file? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded from .env"
fi

# Check required environment variables
REQUIRED_VARS=("AWS_REGION" "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please set these variables in your .env file or environment"
    exit 1
fi

# Default values
export APP_ENV=${APP_ENV:-production}
export PORT=${PORT:-8000}
export LOG_LEVEL=${LOG_LEVEL:-info}
export ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*}
export RATE_LIMIT_REQUESTS=${RATE_LIMIT_REQUESTS:-100}
export RATE_LIMIT_WINDOW=${RATE_LIMIT_WINDOW:-60}
export LOG_REQUESTS=${LOG_REQUESTS:-true}
export LOG_RESPONSES=${LOG_RESPONSES:-false}

# Display configuration
echo ""
echo "📋 Configuration:"
echo "   Environment: $APP_ENV"
echo "   Port: $PORT"
echo "   Log Level: $LOG_LEVEL"
echo "   AWS Region: $AWS_REGION"
echo "   Rate Limit: $RATE_LIMIT_REQUESTS requests per $RATE_LIMIT_WINDOW seconds"
echo "   CORS Origins: $ALLOWED_ORIGINS"
echo ""

# Check if running in Docker
if [ -f /.dockerenv ]; then
    echo "🐳 Running in Docker container"
    exec uvicorn main:app --host 0.0.0.0 --port $PORT --log-level $LOG_LEVEL
else
    echo "💻 Running locally"
    
    # Check if Python virtual environment is activated
    if [ -z "$VIRTUAL_ENV" ]; then
        echo "⚠️  Warning: No virtual environment detected"
        echo "💡 Consider activating a virtual environment:"
        echo "   python -m venv venv"
        echo "   source venv/bin/activate  # On Linux/Mac"
        echo "   venv\\Scripts\\activate   # On Windows"
        echo ""
    fi
    
    # Install dependencies if requirements.txt exists
    if [ -f requirements.txt ]; then
        echo "📦 Installing/updating dependencies..."
        pip install -r requirements.txt
    fi
    
    # Run the application
    echo "🚀 Starting server..."
    uvicorn main:app --host 0.0.0.0 --port $PORT --log-level $LOG_LEVEL --reload
fi 