# 🔐 SSL Setup Guide for Bedrock API Gateway

This guide explains how to set up SSL certificates for secure HTTPS connections to your API Gateway.

## 🎯 Why SSL is Important

### Security Benefits
- **Data Encryption**: Protects data in transit between client and server
- **Authentication**: Verifies server identity to prevent impersonation
- **Integrity**: Ensures data hasn't been tampered with during transmission

### Business Benefits
- **Trust**: Browsers show secure lock icon 🔒
- **SEO**: Search engines prefer HTTPS sites
- **Compliance**: Required for PCI DSS, HIPAA, and other regulations
- **API Security**: Essential for production API endpoints

## 📋 SSL Certificate Types

### 1. **Self-Signed Certificates**
- ✅ **Pros**: Free, quick setup, good for development
- ❌ **Cons**: Browser warnings, not trusted by default
- 🎯 **Use Case**: Development, testing, internal tools

### 2. **Let's Encrypt (Free)**
- ✅ **Pros**: Free, trusted by all browsers, auto-renewal
- ❌ **Cons**: 90-day validity, requires domain validation
- 🎯 **Use Case**: Production, public-facing APIs

### 3. **Commercial Certificates**
- ✅ **Pros**: Longer validity, support, warranty
- ❌ **Cons**: Cost, manual renewal process
- 🎯 **Use Case**: Enterprise, high-traffic applications

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)
```bash
cd bedrock-api-gateway
chmod +x ssl-setup.sh
./ssl-setup.sh
```

### Option 2: Manual Setup
Choose one of the following methods:

## 🛠️ Manual SSL Setup Methods

### Method 1: Self-Signed Certificate (Development)

```bash
# Create SSL directory
mkdir -p ssl && cd ssl

# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out csr.pem \
  -subj "/C=TH/ST=ChiangMai/L=ChiangMai/O=MFU/OU=IT/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -in csr.pem -signkey private.key -out fullchain.pem -days 365

# Generate DH parameters
openssl dhparam -out dhparam.pem 2048

# Set permissions
chmod 600 private.key
chmod 644 fullchain.pem dhparam.pem
```

### Method 2: Let's Encrypt Certificate (Production)

```bash
# Install certbot
sudo apt-get update && sudo apt-get install -y certbot

# Generate certificate
sudo certbot certonly \
  --standalone \
  --preferred-challenges http \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  --domains your-domain.com

# Copy certificates to ssl directory
mkdir -p ssl && cd ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./private.key

# Generate DH parameters
openssl dhparam -out dhparam.pem 2048

# Fix permissions
sudo chown $USER:$USER fullchain.pem private.key dhparam.pem
chmod 600 private.key
chmod 644 fullchain.pem dhparam.pem
```

### Method 3: Commercial Certificate

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out domain.csr

# Submit CSR to Certificate Authority
# Download certificate files from CA
# Place certificate files in ssl directory

# Combine certificate chain
cat your-certificate.crt intermediate.crt > fullchain.pem

# Generate DH parameters
openssl dhparam -out dhparam.pem 2048

# Set permissions
chmod 600 private.key
chmod 644 fullchain.pem dhparam.pem
```

## 🔧 Configuration

### 1. Update nginx.conf

Edit `nginx.conf` and replace:
```nginx
server_name your-domain.com;  # Replace with your actual domain
```

### 2. Update docker-compose.yml

Ensure SSL volume is mounted:
```yaml
volumes:
  - ./ssl:/etc/nginx/ssl:ro
```

### 3. Start with SSL

```bash
# Start with Nginx SSL proxy
docker-compose --profile with-nginx up -d

# Check logs
docker-compose logs nginx
```

## 🔍 SSL Verification

### Check Certificate Details
```bash
# Check certificate info
openssl x509 -in ssl/fullchain.pem -text -noout

# Check certificate expiration
openssl x509 -in ssl/fullchain.pem -noout -dates

# Verify certificate matches private key
openssl x509 -noout -modulus -in ssl/fullchain.pem | openssl md5
openssl rsa -noout -modulus -in ssl/private.key | openssl md5
```

### Test SSL Connection
```bash
# Test HTTPS endpoint
curl -I https://your-domain.com/health

# Test SSL with detailed info
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### Browser Testing
1. Open https://your-domain.com in browser
2. Check for green lock icon 🔒
3. Click lock icon to view certificate details
4. Verify certificate is valid and trusted

## 🔄 Certificate Renewal

### Let's Encrypt Auto-Renewal
```bash
# Add to crontab for automatic renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -

# Test renewal
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew
```

### Commercial Certificate Renewal
1. Purchase new certificate before expiration
2. Generate new CSR or reuse existing
3. Download new certificate files
4. Replace old certificate files
5. Restart nginx container

## 🚨 Troubleshooting

### Common Issues

#### 1. **Browser Security Warning**
```
Problem: "Your connection is not private"
Solution: 
- Check certificate validity
- Verify domain name matches certificate
- Clear browser cache
```

#### 2. **Certificate Mismatch**
```
Problem: SSL certificate doesn't match private key
Solution:
- Verify certificate and key were generated together
- Check certificate hash matches key hash
```

#### 3. **Let's Encrypt Rate Limits**
```
Problem: "Too many certificates already issued"
Solution:
- Wait for rate limit to reset (weekly)
- Use staging environment for testing
```

#### 4. **Domain Validation Failed**
```
Problem: Let's Encrypt can't verify domain
Solution:
- Ensure domain points to your server
- Check firewall allows HTTP (port 80)
- Verify DNS propagation
```

### Debug Commands

```bash
# Check nginx configuration
docker-compose exec nginx nginx -t

# View nginx logs
docker-compose logs nginx

# Check certificate files
ls -la ssl/

# Test SSL configuration
openssl s_client -connect localhost:443 -servername your-domain.com
```

## 📚 Best Practices

### Security
1. **Strong Ciphers**: Use modern TLS versions (1.2+)
2. **HSTS**: Enable HTTP Strict Transport Security
3. **Perfect Forward Secrecy**: Use DH parameters
4. **Certificate Transparency**: Monitor certificate logs

### Operations
1. **Monitoring**: Set up certificate expiration alerts
2. **Backup**: Keep certificate backups securely
3. **Rotation**: Regular certificate rotation
4. **Testing**: Regular SSL testing and validation

### Performance
1. **Session Resumption**: Enable SSL session caching
2. **OCSP Stapling**: Reduce certificate validation time
3. **Compression**: Enable gzip compression
4. **HTTP/2**: Use HTTP/2 for better performance

## 🔗 Useful Resources

### SSL Testing Tools
- **SSL Labs**: https://www.ssllabs.com/ssltest/
- **SSL Checker**: https://www.sslchecker.com/
- **Certificate Transparency**: https://crt.sh/

### Certificate Authorities
- **Let's Encrypt**: https://letsencrypt.org/
- **Cloudflare**: https://www.cloudflare.com/ssl/
- **DigiCert**: https://www.digicert.com/
- **GlobalSign**: https://www.globalsign.com/

### Documentation
- **OpenSSL**: https://www.openssl.org/docs/
- **Nginx SSL**: https://nginx.org/en/docs/http/configuring_https_servers.html
- **Certbot**: https://certbot.eff.org/

---

## 🏁 Quick Start Summary

1. **Run SSL Setup Script**:
   ```bash
   ./ssl-setup.sh
   ```

2. **Update Configuration**:
   ```bash
   # Edit nginx.conf with your domain
   nano nginx.conf
   ```

3. **Start with SSL**:
   ```bash
   docker-compose --profile with-nginx up -d
   ```

4. **Test**:
   ```bash
   curl -I https://your-domain.com/health
   ```

🎉 **Congratulations!** Your API Gateway is now secured with SSL! 