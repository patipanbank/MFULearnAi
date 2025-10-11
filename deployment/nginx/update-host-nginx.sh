#!/bin/bash
# Script to update host NGINX configuration to proxy to Kubernetes Ingress
# This script should be run on the server with sudo privileges

set -e

echo "=========================================="
echo "Updating Host NGINX Configuration"
echo "=========================================="

# Backup existing config
echo "Creating backup..."
sudo cp /etc/nginx/sites-available/mfulearnai.mfu.ac.th /etc/nginx/sites-available/mfulearnai.mfu.ac.th.backup.$(date +%Y%m%d_%H%M%S)

# Copy new config
echo "Copying new configuration..."
sudo cp deployment/nginx/mfulearnai.mfu.ac.th.conf /etc/nginx/sites-available/mfulearnai.mfu.ac.th

# Test configuration
echo "Testing NGINX configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration test passed!"

    # Reload NGINX
    echo "Reloading NGINX..."
    sudo nginx -s reload

    echo "=========================================="
    echo "✅ NGINX updated successfully!"
    echo "Now proxying to Kubernetes Ingress on localhost:31530"
    echo "=========================================="
else
    echo "❌ Configuration test failed!"
    echo "Restoring backup..."
    sudo cp /etc/nginx/sites-available/mfulearnai.mfu.ac.th.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/mfulearnai.mfu.ac.th
    exit 1
fi

# Show status
echo ""
echo "Testing endpoint..."
sleep 2
curl -k -I https://mfulearnai.mfu.ac.th/api/auth/login/saml 2>&1 | head -10
