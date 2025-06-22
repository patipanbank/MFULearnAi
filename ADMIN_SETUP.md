# MFU Learn AI - Admin Setup Guide

## การสร้าง Admin User

### วิธีที่ 1: ใช้ Batch File (แนะนำสำหรับ Windows)

1. Double-click ไฟล์ `create_admin.bat`
2. Script จะตรวจสอบและเริ่ม Docker containers อัตโนมัติ
3. ทำตามขั้นตอนในเมนู

### วิธีที่ 2: ใช้ Command Line

```bash
# ตั้งค่า environment variable
set MONGODB_URI=mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin

# รัน script
python create_admin.py
```

### วิธีที่ 3: ใช้ PowerShell

```powershell
$env:MONGODB_URI="mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin"
python create_admin.py
```

## ฟีเจอร์ที่มี

### 1. สร้าง Admin ใหม่
- กรอกข้อมูล: Username, Password, Email, ชื่อ-นามสกุล, แผนก
- ตรวจสอบความถูกต้องของข้อมูล
- เข้ารหัส password อัตโนมัติ
- บันทึกลงฐานข้อมูล

### 2. แสดงรายชื่อ Admin
- แสดงรายการ Admin ทั้งหมดในระบบ
- แสดงข้อมูล: ID, Username, ชื่อ, แผนก, บทบาท

### 3. สร้าง Super Admin
- ใช้เมื่อยังไม่มี Admin ในระบบ
- สร้าง Super Admin พร้อม password เริ่มต้น
- มีสิทธิ์สูงสุดในระบบ

## ข้อกำหนดเบื้องต้น

1. **Docker Desktop** - ต้องรันอยู่ในเครื่อง
2. **Python 3.7+** - ติดตั้งในระบบ
3. **MongoDB Container** - รันผ่าน docker-compose
4. **Backend Dependencies** - ติดตั้งแล้วใน backend folder

## การตั้งค่า Environment

### ตัวอย่างไฟล์ .env

```env
MONGODB_URI=mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin
JWT_SECRET=mfulearnai_jwt_secret_key_2024
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
PORT=5000
LOG_LEVEL=info
```

## การแก้ไขปัญหา

### ❌ "No default database defined"

**สาเหตุ:** MongoDB connection string ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบว่า Docker containers ทำงานอยู่: `docker ps`
2. ตั้งค่า MONGODB_URI ให้ถูกต้อง:
   ```bash
   MONGODB_URI=mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin
   ```

### ❌ "Command find requires authentication"

**สาเหตุ:** ไม่มี authentication credentials

**วิธีแก้:**
1. ตรวจสอบ username/password ใน connection string
2. ตรวจสอบ authSource=admin ใน connection string

### ❌ "Connection refused"

**สาเหตุ:** MongoDB container ไม่ทำงาน

**วิธีแก้:**
1. เริ่ม Docker containers: `docker-compose up -d`
2. รอสักครู่ให้ MongoDB เริ่มทำงาน
3. ตรวจสอบ: `docker ps | grep mongo`

### ❌ "Department with this name already exists"

**สาเหตุ:** ระบบตรวจพบแผนกซ้ำ

**วิธีแก้:**
1. ใช้ชื่อแผนกที่มีอยู่แล้วในระบบ
2. หรือใช้ชื่อแผนกใหม่ที่ไม่ซ้ำ

## ข้อมูล Admin ที่สร้าง

เมื่อสร้าง Admin สำเร็จ จะได้ข้อมูลดังนี้:

- **Role:** Admin
- **Groups:** ['Admin']
- **Password:** เข้ารหัสด้วย bcrypt
- **Created/Updated:** วันที่และเวลาปัจจุบัน

## การใช้งานหลังสร้าง Admin

1. เปิดเว็บไซต์: `http://mfulearnai.mfu.ac.th`
2. ไปที่หน้า Admin Login
3. ใช้ Username และ Password ที่สร้างไว้
4. เข้าสู่ระบบจัดการ

## ความปลอดภัย

- ⚠️ **เปลี่ยน password หลัง login ครั้งแรก**
- ⚠️ **ไม่แชร์ข้อมูล login กับผู้อื่น**
- ⚠️ **ใช้ password ที่แข็งแรง**
- ⚠️ **ตั้งค่า JWT_SECRET ใหม่ใน production**

## ติดต่อสอบถาม

หากมีปัญหาในการใช้งาน สามารถตรวจสอบ logs ได้ที่:

- Backend logs: `docker logs mfulearnai-backend-1`
- MongoDB logs: `docker logs mfulearnai_db`
- Script output: ดูใน terminal ที่รัน script 