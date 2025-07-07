# 🚀 **NestJS Deployment Guide**

## 📋 **Pre-Deployment Checklist**

### **🔧 Server Requirements**
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **MongoDB**: >= 4.4
- **Redis**: >= 6.0
- **ChromaDB**: >= 0.4.0
- **Memory**: >= 2GB RAM
- **Storage**: >= 10GB free space

### **🌐 Environment Setup**
```bash
# 1. Create environment file
cp .env.example .env

# 2. Configure environment variables
nano .env
```

### **📦 Required Environment Variables**
```env
# Application
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# Database
MONGODB_URI=mongodb://localhost:27017/mfulearnai

# Redis
REDIS_URL=redis://localhost:6379

# ChromaDB
CHROMADB_URL=http://localhost:8000

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_ALGORITHM=HS256

# AWS Bedrock
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# SAML
SAML_SP_ENTITY_ID=your-sp-entity-id
SAML_IDP_ENTITY_ID=your-idp-entity-id
SAML_IDP_SSO_URL=https://your-idp.com/sso
SAML_IDP_SLO_URL=https://your-idp.com/slo
SAML_CERTIFICATE=your-base64-certificate
```

---

## 🔄 **Deployment Steps**

### **Step 1: Build Application**
```bash
# Install dependencies
npm install --only=production

# Build application
npm run build

# Verify build
ls -la dist/
```

### **Step 2: Start Services**
```bash
# Start in production mode
npm start

# Or with PM2 (recommended)
pm2 start dist/main.js --name "mfu-backend-node"
```

### **Step 3: Verify Deployment**
```bash
# Health check
curl http://localhost:5000/health

# API documentation
curl http://localhost:5000/docs
```

---

## 🐳 **Docker Deployment**

### **Build Docker Image**
```bash
# Build image
docker build -t mfu-backend-node .

# Run container
docker run -p 5000:5000 \
  -e PORT=5000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/mfulearnai \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  mfu-backend-node
```

### **Docker Compose**
```yaml
version: '3.8'
services:
  backend-node:
    build: ./backend-node
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/mfulearnai
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
      - chromadb
```

---

## 🔄 **Migration from FastAPI**

### **Option 1: Gradual Migration (Recommended)**
```bash
# 1. Start NestJS on different port
PORT=5000 npm start

# 2. Update load balancer to route some traffic
# Configure nginx/apache to route specific endpoints

# 3. Monitor and gradually increase traffic
# Use nginx upstream configuration

# 4. Complete migration after validation
# Stop FastAPI service
```

### **Option 2: Complete Switch**
```bash
# 1. Stop FastAPI service
sudo systemctl stop mfu-backend-python

# 2. Start NestJS on port 8000
PORT=8000 npm start

# 3. Update configuration
# No load balancer changes needed
```

---

## 🔧 **Production Configuration**

### **PM2 Configuration**
```json
{
  "apps": [{
    "name": "mfu-backend-node",
    "script": "dist/main.js",
    "instances": "max",
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production",
      "PORT": 5000
    },
    "error_file": "logs/err.log",
    "out_file": "logs/out.log",
    "log_file": "logs/combined.log"
  }]
}
```

### **Nginx Configuration**
```nginx
upstream nestjs_backend {
    server localhost:5000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location /api {
        proxy_pass http://nestjs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io {
        proxy_pass http://nestjs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🛡️ **Security Configuration**

### **Firewall Rules**
```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Allow application port (internal only)
sudo ufw allow from 127.0.0.1 to any port 5000
```

### **SSL/TLS Setup**
```bash
# Install Let's Encrypt
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 📊 **Monitoring & Logging**

### **Health Checks**
```bash
# Application health
curl http://localhost:5000/health

# Database health
curl http://localhost:5000/health/db

# Redis health
curl http://localhost:5000/health/redis
```

### **Log Management**
```bash
# Application logs
tail -f logs/combined.log

# PM2 logs
pm2 logs mfu-backend-node

# System logs
sudo journalctl -u mfu-backend-node -f
```

### **Performance Monitoring**
```bash
# PM2 monitoring
pm2 monit

# System resources
htop
iotop
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Port Already in Use**
```bash
# Check what's using the port
sudo lsof -i :5000

# Kill the process
sudo kill -9 <PID>
```

#### **Database Connection Issues**
```bash
# Check MongoDB status
sudo systemctl status mongodb

# Check connection
mongo --eval "db.runCommand('ping')"
```

#### **Redis Connection Issues**
```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping
```

#### **ChromaDB Connection Issues**
```bash
# Check ChromaDB status
curl http://localhost:8000/api/v1/heartbeat

# Restart ChromaDB
sudo systemctl restart chromadb
```

---

## 🔄 **Rollback Procedures**

### **Immediate Rollback**
```bash
# Stop NestJS
pm2 stop mfu-backend-node

# Start FastAPI
sudo systemctl start mfu-backend-python

# Verify service
curl http://localhost:8000/health
```

### **Configuration Rollback**
```bash
# Restore nginx config
sudo cp /etc/nginx/sites-available/mfu-backend-python.bak /etc/nginx/sites-available/mfu-backend
sudo systemctl reload nginx

# Restore environment variables
cp .env.fastapi .env
```

---

## 📞 **Support Information**

### **Log Locations**
- **Application**: `logs/combined.log`
- **PM2**: `~/.pm2/logs/`
- **Nginx**: `/var/log/nginx/`
- **System**: `/var/log/syslog`

### **Service Commands**
```bash
# Start service
pm2 start mfu-backend-node

# Stop service
pm2 stop mfu-backend-node

# Restart service
pm2 restart mfu-backend-node

# View logs
pm2 logs mfu-backend-node

# Service status
pm2 status
```

---

## 🎉 **Post-Deployment Verification**

### **Functional Testing**
```bash
# Test authentication
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Test WebSocket
# Use WebSocket client to test connection

# Test file upload
curl -X POST http://localhost:5000/api/upload \
  -F "file=@test.txt" \
  -H "Authorization: Bearer <token>"
```

### **Performance Testing**
```bash
# Load testing with ab
ab -n 1000 -c 10 http://localhost:5000/health

# Memory usage
free -h
ps aux | grep node
```

---

**🚀 Deployment Complete!** 

Your NestJS backend is now running in production. Monitor the logs and health endpoints to ensure everything is working correctly. 