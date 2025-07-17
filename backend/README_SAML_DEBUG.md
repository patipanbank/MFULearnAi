# SAML Debug Guide

## วัตถุประสงค์
แก้ไข SAML service เพื่อแสดงข้อมูล raw ที่ได้จาก IDP ก่อนเขียน logic การแปลงค่า

## การเปลี่ยนแปลงที่ทำ

### 1. เพิ่ม Logging ใน SAML Service (`saml.service.ts`)
- แสดง decoded SAML response ทั้งหมด
- แสดง attributes ทั้งหมดที่พบ
- แสดง attribute values ทั้งหมด

### 2. เพิ่ม Logging ใน Auth Controller (`auth.controller.ts`)
- แสดง request headers ทั้งหมด
- แสดง request body ทั้งหมด
- แสดง query parameters

### 3. สร้าง Test Script (`test-saml-debug.js`)
- ทดสอบ SAML callback ด้วย mock data

## วิธีการทดสอบ

### 1ัน Backend
```bash
cd backend
npm run start:dev
```

###2ทดสอบด้วย Real SAML IDP1 `http://localhost:3000pi/auth/saml/login`
2. ระบบจะ redirect ไปยัง SAML IDP
3. หลังจาก login สำเร็จ IDP จะส่งข้อมูลกลับมา
4. ดู logs ใน console เพื่อเห็นข้อมูล raw

###3อบด้วย Test Script
```bash
cd backend
npm install axios
node test-saml-debug.js
```

## ข้อมูลที่จะเห็นใน Logs

### Auth Controller
```
=== AUTH CONTROLLER - COMPLETE REQUEST ===
Method: POST
URL: /api/auth/saml/callback
Headers: {...}
Body:[object Object]...}
Query: [object Object]...}
```

### SAML Service
```
=== COMPLETE DECODED SAML RESPONSE ===
<samlp:Response xmlns:samlp="...">
  ...
</samlp:Response>

=== EXTRACTED ATTRIBUTES ===
Found NameID: user@example.com
Found email: user@example.com
...

=== ALL SAML ATTRIBUTES FOUND ===
Attribute 1aml:Attribute Name="username">...</saml:Attribute>
...
```

## ขั้นตอนต่อไป
1. วิเคราะห์โครงสร้าง SAML response ที่ได้จาก IDP จริง
2. ปรับ regex patterns และ attribute mapping ให้ตรงกับข้อมูลจริง3 ลบ logging ที่ไม่จำเป็นออกหลังจาก debug เสร็จ 