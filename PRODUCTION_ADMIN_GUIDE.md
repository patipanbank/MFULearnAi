# 🏭 MFU Learn AI - Production Admin Setup Guide

วิธีการสร้าง admin และ super admin สำหรับ production server

## 📋 ข้อมูลที่ตรวจพบจาก Environment

จากไฟล์ `.env` และ `docker-compose.yml` ของคุณ:

### 🗄️ **Database Configuration**
```bash
# MongoDB (จาก docker-compose.yml)
MONGODB_URI=mongodb://root:1234@db:27017/mfu_chatbot?authSource=admin

# สำหรับเชื่อมต่อจากภายนอก container:
MONGODB_URI=mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin
```

### 🌐 **Production Environment**
```bash
APP_ENV=production
NGINX_SERVER_NAME=mfulearnai.mfu.ac.th
JWT_SECRET=cd343ae6f65f6b6e164289b860c89442edc01c7c8ef327d3959e56d542fffbc15065cd1e88e10c8e15754997d252aaedfde3a38a3733f55dcdabfdcf1e27098a
AWS_REGION=us-east-1
```

---

## 🚀 **วิธีการใช้งาน**

### **Method 1: Production Auto-Setup (แนะนำ)**

```bash
# ทำให้ script executable
chmod +x create_admin_production.sh

# ตรวจสอบ environment ก่อน
./create_admin_production.sh --check

# รัน production setup
./create_admin_production.sh
```

**Features:**
- ✅ โหลดค่าจาก `.env` อัตโนมัติ
- ✅ ตรวจจับ MongoDB URI จาก docker-compose.yml
- ✅ ติดตั้ง dependencies ที่จำเป็น
- ✅ แนะนำค่า default สำหรับ production

---

### **Method 2: Manual Environment Setup**

```bash
# Set environment variables จาก production config
export MONGODB_URI="mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin"
export JWT_SECRET="cd343ae6f65f6b6e164289b860c89442edc01c7c8ef327d3959e56d542fffbc15065cd1e88e10c8e15754997d252aaedfde3a38a3733f55dcdabfdcf1e27098a"
export AWS_REGION="us-east-1"

# Set admin credentials
export ADMIN_USERNAME="superadmin"
export ADMIN_PASSWORD="YourSecurePassword123!"
export ADMIN_EMAIL="superadmin@mfu.ac.th"
export ADMIN_DEPARTMENT="IT"
export ADMIN_ROLE="SuperAdmin"

# Run script
./create_admin.sh
```

---

### **Method 3: Docker Container Method**

```bash
# ถ้าต้องการรันใน Docker container
docker exec -it mfulearnai-backend-1 /bin/bash

# ภายใน container:
export MONGODB_URI="mongodb://root:1234@db:27017/mfu_chatbot?authSource=admin"
node create_admin.js
```

---

### **Method 4: Direct Node.js Script**

```bash
# Install dependencies
npm install mongoose bcryptjs

# Load environment และรัน
source .env  # หรือ export จาก .env
node create_admin.js
```

---

## 🎯 **Recommended Production Admin Setup**

### **SuperAdmin Account (ระดับสูงสุด)**
```bash
Username: superadmin
Email: superadmin@mfu.ac.th
Department: IT
Role: SuperAdmin
Password: [Strong password 12+ chars]
```

**Permissions:**
- ✅ System management (usage stats, queue management)
- ✅ User quota management
- ✅ System analytics
- ✅ All department permissions

### **Department Admins (แต่ละหน่วยงาน)**
```bash
Username: it_admin / science_admin / etc.
Email: it.admin@mfu.ac.th
Department: IT / Science / etc.
Role: Admin
Password: [Strong password]
```

**Permissions:**
- ✅ Department collection/agent management
- ✅ Department-level permissions
- ❌ System-wide management

---

## 🔧 **Production Environment Details**

### **Database Connection**
```bash
# Production MongoDB (inside Docker network)
mongodb://root:1234@db:27017/mfu_chatbot?authSource=admin

# External access (if port 27017 is exposed)
mongodb://root:1234@mfulearnai.mfu.ac.th:27017/mfu_chatbot?authSource=admin
```

### **Security Configuration**
```bash
# JWT Configuration (from .env)
JWT_SECRET=cd343ae6f65f6b6e164289b860c89442edc01c7c8ef327d3959e56d542fffbc15065cd1e88e10c8e15754997d252aaedfde3a38a3733f55dcdabfdcf1e27098a
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200

# CORS and URLs
PROD_FRONTEND_URL=https://mfulearnai.mfu.ac.th
PROD_ALLOWED_ORIGINS=https://mfulearnai.mfu.ac.th,https://authsso.mfu.ac.th
```

---

## 🔒 **Security Best Practices**

### **Password Requirements**
```bash
# Generate secure password
openssl rand -base64 32

# Or use passphrase
"MFULearnAI2024!SuperAdmin"
```

### **File Permissions**
```bash
# Secure script files
chmod 700 create_admin*.sh
chmod 600 .env*

# Don't commit credentials
echo ".env.admin" >> .gitignore
echo "*.log" >> .gitignore
```

### **Audit Trail**
```bash
# Log admin creation
echo "$(date): Created admin user: $ADMIN_USERNAME" >> /var/log/mfu-admin.log

# Monitor admin logins
tail -f /var/log/nginx/access.log | grep "/admin/login"
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

**1. MongoDB Connection Failed**
```bash
# Check MongoDB service
docker ps | grep mongo
docker logs mfulearnai_db

# Test connection
docker exec -it mfulearnai_db mongosh "mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin"
```

**2. Permission Denied**
```bash
# Fix script permissions
chmod +x create_admin_production.sh
chown $USER:$USER create_admin*
```

**3. Node.js Dependencies**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install mongoose bcryptjs
```

**4. Environment Variables Not Loaded**
```bash
# Check .env file
cat .env | grep -E "(MONGODB_URI|JWT_SECRET)"

# Manual export
source .env
printenv | grep MONGODB_URI
```

---

## 📊 **Verification Steps**

### **1. Admin Creation Successful**
```bash
✅ Connected to MongoDB successfully!
✅ Admin user created successfully!

📋 User Details:
   Username: superadmin
   Email: superadmin@mfu.ac.th
   Role: SuperAdmin
   Department: IT
   Token Quota: 100000
   Daily Limit: 50000
```

### **2. Test Login**
```bash
# Test admin login
curl -X POST https://mfulearnai.mfu.ac.th/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"YourPassword"}'
```

### **3. Verify Permissions**
```bash
# Test SuperAdmin endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://mfulearnai.mfu.ac.th/api/usage/system

curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://mfulearnai.mfu.ac.th/api/queue/stats
```

---

## 📝 **Production Checklist**

- [ ] **Environment Setup**
  - [ ] `.env` file exists with production values
  - [ ] MongoDB is accessible
  - [ ] Node.js and npm installed

- [ ] **Security Setup**
  - [ ] Strong passwords generated
  - [ ] File permissions set correctly
  - [ ] Credentials not in git

- [ ] **Admin Accounts**
  - [ ] SuperAdmin created successfully
  - [ ] Department admins created
  - [ ] Login tested

- [ ] **System Verification**
  - [ ] Admin dashboard accessible
  - [ ] System management functions work
  - [ ] User permissions verified

- [ ] **Documentation**
  - [ ] Admin credentials stored securely
  - [ ] Setup process documented
  - [ ] Recovery procedures established

---

## 🆘 **Emergency Access**

ถ้า admin account มีปัญหา:

```bash
# Create emergency SuperAdmin
export ADMIN_USERNAME="emergency_admin"
export ADMIN_PASSWORD="$(openssl rand -base64 32)"
export ADMIN_EMAIL="emergency@mfu.ac.th"
export ADMIN_ROLE="SuperAdmin"

./create_admin_production.sh

# Save credentials securely
echo "Emergency Admin: $ADMIN_USERNAME / $ADMIN_PASSWORD" | gpg --encrypt > emergency_admin.gpg
```

---

**📞 Support:** สำหรับปัญหาการติดตั้ง ติดต่อ IT Support ของ MFU