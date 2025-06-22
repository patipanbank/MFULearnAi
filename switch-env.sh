#!/bin/bash

# Check if environment argument is provided
if [ -z "$1" ]; then
    echo "Usage: ./switch-env.sh [dev|prod]"
    exit 1
fi

# Validate environment argument
if [ "$1" != "dev" ] && [ "$1" != "prod" ]; then
    echo "Invalid environment. Use 'dev' or 'prod'"
    exit 1
fi

echo "Switching to $1 environment..."

# Stop containers
docker-compose down

# Copy appropriate nginx config
if [ "$1" = "dev" ]; then
    cp ./nginx/nginx.dev.conf.template ./nginx/nginx.conf.template
    echo "Switched to development nginx configuration"
else
    cp ./nginx/nginx.prod.conf.template ./nginx/nginx.conf.template
    echo "Switched to production nginx configuration"
fi

# Rebuild and start containers
docker-compose build nginx
docker-compose up -d

echo "Environment switched successfully to $1"
echo "Containers are starting up..."

# Show container status
docker-compose ps 