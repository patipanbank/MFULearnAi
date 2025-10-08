#!/bin/bash

# SSL Setup Script for Bedrock API Gateway
# This script helps set up SSL certificates for the API Gateway

set -e

echo "🔐 SSL Certificate Setup for Bedrock API Gateway"
echo "================================================"

# Create SSL directory
mkdir -p ssl
cd ssl

# Function to generate self-signed certificate (for development)
generate_self_signed() {
    echo "🔑 Generating self-signed SSL certificate..."
    
    # Generate private key
    openssl genrsa -out private.key 2048
    
    # Generate certificate signing request
    openssl req -new -key private.key -out csr.pem -subj "/C=TH/ST=ChiangMai/L=ChiangMai/O=MFU/OU=IT/CN=localhost"
    
    # Generate self-signed certificate
    openssl x509 -req -in csr.pem -signkey private.key -out fullchain.pem -days 365
    
    # Generate DH parameters for better security
    openssl dhparam -out dhparam.pem 2048
    
    echo "✅ Self-signed certificate generated successfully!"
    echo "📁 Files created:"
    echo "   - private.key (Private key)"
    echo "   - fullchain.pem (Certificate)"
    echo "   - dhparam.pem (DH parameters)"
    echo ""
    echo "⚠️  Note: Self-signed certificates are for development only!"
    echo "   Browsers will show security warnings."
}

# Function to set up Let's Encrypt certificate
setup_letsencrypt() {
    echo "🌍 Setting up Let's Encrypt SSL certificate..."
    
    read -p "Enter your domain name: " DOMAIN
    read -p "Enter your email address: " EMAIL
    
    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        echo "❌ Domain and email are required!"
        exit 1
    fi
    
    echo "📋 Domain: $DOMAIN"
    echo "📧 Email: $EMAIL"
    echo ""
    
    # Install certbot if not already installed
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing certbot..."
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Ubuntu/Debian
            sudo apt-get update
            sudo apt-get install -y certbot
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            brew install certbot
        else
            echo "❌ Please install certbot manually for your OS"
            exit 1
        fi
    fi
    
    # Generate certificate
    sudo certbot certonly \
        --standalone \
        --preferred-challenges http \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN"
    
    # Copy certificates to ssl directory
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ./
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ./private.key
    
    # Generate DH parameters
    openssl dhparam -out dhparam.pem 2048
    
    # Fix permissions
    sudo chown $USER:$USER fullchain.pem private.key dhparam.pem
    chmod 600 private.key
    chmod 644 fullchain.pem dhparam.pem
    
    echo "✅ Let's Encrypt certificate set up successfully!"
    echo "🔄 Certificate will auto-renew via certbot"
}

# Function to use existing certificate
use_existing_cert() {
    echo "📂 Using existing SSL certificate..."
    
    read -p "Enter path to your certificate file (fullchain.pem): " CERT_PATH
    read -p "Enter path to your private key file: " KEY_PATH
    
    if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
        echo "❌ Certificate or key file not found!"
        exit 1
    fi
    
    # Copy certificates
    cp "$CERT_PATH" ./fullchain.pem
    cp "$KEY_PATH" ./private.key
    
    # Generate DH parameters if not exists
    if [ ! -f "dhparam.pem" ]; then
        echo "🔑 Generating DH parameters..."
        openssl dhparam -out dhparam.pem 2048
    fi
    
    # Fix permissions
    chmod 600 private.key
    chmod 644 fullchain.pem dhparam.pem
    
    echo "✅ Existing certificate configured successfully!"
}

# Function to verify SSL setup
verify_ssl() {
    echo "🔍 Verifying SSL configuration..."
    
    if [ ! -f "fullchain.pem" ] || [ ! -f "private.key" ] || [ ! -f "dhparam.pem" ]; then
        echo "❌ Missing SSL files!"
        return 1
    fi
    
    # Check certificate validity
    if openssl x509 -in fullchain.pem -text -noout > /dev/null 2>&1; then
        echo "✅ Certificate is valid"
        
        # Show certificate details
        echo "📋 Certificate Details:"
        openssl x509 -in fullchain.pem -text -noout | grep -A 1 "Subject:"
        openssl x509 -in fullchain.pem -text -noout | grep -A 2 "Validity"
        
        # Check if certificate matches private key
        cert_hash=$(openssl x509 -noout -modulus -in fullchain.pem | openssl md5)
        key_hash=$(openssl rsa -noout -modulus -in private.key | openssl md5)
        
        if [ "$cert_hash" = "$key_hash" ]; then
            echo "✅ Certificate matches private key"
        else
            echo "❌ Certificate does not match private key!"
            return 1
        fi
    else
        echo "❌ Certificate is invalid!"
        return 1
    fi
    
    echo "✅ SSL configuration verified successfully!"
}

# Main menu
echo "Choose SSL setup option:"
echo "1) Generate self-signed certificate (Development)"
echo "2) Set up Let's Encrypt certificate (Production)"
echo "3) Use existing certificate"
echo "4) Verify current SSL setup"
echo "5) Exit"

read -p "Select option (1-5): " choice

case $choice in
    1)
        generate_self_signed
        verify_ssl
        ;;
    2)
        setup_letsencrypt
        verify_ssl
        ;;
    3)
        use_existing_cert
        verify_ssl
        ;;
    4)
        if verify_ssl; then
            echo "🎉 SSL setup is ready!"
        else
            echo "❌ SSL setup needs attention"
            exit 1
        fi
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option!"
        exit 1
        ;;
esac

echo ""
echo "🚀 Next steps:"
echo "1. Update nginx.conf with your domain name"
echo "2. Run: docker-compose --profile with-nginx up -d"
echo "3. Test: curl -I https://your-domain.com/health"
echo ""
echo "📚 SSL files location: $(pwd)"
echo "   - fullchain.pem: Certificate chain"
echo "   - private.key: Private key"
echo "   - dhparam.pem: DH parameters" 