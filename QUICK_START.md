# 🚀 **Quick Start Guide - NestJS Backend**

## ⚡ **5-Minute Setup**

### **1. Prerequisites**
```bash
✅ Node.js 18+ installed
✅ npm 8+ installed
✅ MongoDB running
✅ Redis running
✅ ChromaDB running
```

### **2. Install & Build**
```bash
# Install dependencies
npm install

# Build application
npm run build

# Start development server
npm run start:dev
```

### **3. Verify Installation**
```bash
# Health check
curl http://localhost:5000/health

# API documentation
open http://localhost:5000/docs
```

---

## 🔧 **Environment Setup**

### **Copy Environment Template**
```bash
# Copy template
cp .env.example .env

# Edit configuration
nano .env
```

### **Minimum Required Variables**
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mfulearnai
REDIS_URL=redis://localhost:6379
CHROMADB_URL=http://localhost:8000
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
```

---

## 🧪 **Quick Test**

### **Test Authentication**
```bash
# Login test
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### **Test WebSocket**
```javascript
// Browser console
const socket = io('http://localhost:5000');
socket.on('connect', () => console.log('Connected!'));
```

---

## 📊 **Server Status**

### **Health Endpoints**
```bash
# Overall health
GET /health

# Database health
GET /health/db

# Redis health
GET /health/redis
```

### **Service URLs**
- **API**: http://localhost:5000/api
- **Docs**: http://localhost:5000/docs
- **Health**: http://localhost:5000/health
- **WebSocket**: ws://localhost:5000/socket.io

---

## 🔄 **Migration from FastAPI**

### **Quick Migration Steps**
```bash
# 1. Stop FastAPI
sudo systemctl stop mfu-backend-python

# 2. Update environment
cp ../backend/.env .env
sed -i 's/8000/5000/g' .env

# 3. Start NestJS
npm run start:dev

# 4. Test endpoints
curl http://localhost:5000/health
```

### **Frontend Changes**
```javascript
// Update API base URL
const API_BASE_URL = 'http://localhost:5000';

// Update WebSocket connection
const socket = io('http://localhost:5000');
```

---

## 🛠️ **Common Commands**

### **Development**
```bash
# Start with hot reload
npm run start:dev

# Build for production
npm run build

# Start production server
npm start
```

### **Monitoring**
```bash
# View logs
tail -f logs/application.log

# Check processes
ps aux | grep node

# Monitor resources
htop
```

---

## 🚨 **Troubleshooting**

### **Port Already in Use**
```bash
# Check what's using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

### **Database Connection**
```bash
# Test MongoDB
mongo --eval "db.runCommand('ping')"

# Test Redis
redis-cli ping
```

### **Permission Issues**
```bash
# Fix file permissions
chmod +x dist/main.js

# Run with sudo if needed
sudo npm start
```

---

## 🎯 **Next Steps**

1. **✅ Basic Setup Complete**
2. **🔄 Configure Production Environment**
3. **📊 Set Up Monitoring**
4. **🔐 Configure SSL/TLS**
5. **🚀 Deploy to Production**

---

**🎉 You're Ready to Go!**

Your NestJS backend is now running and ready for development or production deployment. 