# Domain Migration: dindinai.mfu.ac.th → mfulearnai.mfu.ac.th

## ✅ ไฟล์ที่แก้ไขแล้ว

### Backend
1. **`backend/server.ts`**
   - ✅ เปลี่ยน default CORS origin จาก `https://dindinai.mfu.ac.th` เป็น `https://mfulearnai.mfu.ac.th`
   - Line 43: `const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://mfulearnai.mfu.ac.th'];`

### Frontend
2. **`frontend/src/components/header/header.tsx`**
   - ✅ เปลี่ยน hardcoded URL จาก `https://dindinai.mfu.ac.th/login` เป็น `https://mfulearnai.mfu.ac.th/login`
   - Line 21: `window.open('https://mfulearnai.mfu.ac.th/login', '_blank');`

### Nginx
3. **`nginx/nginx.conf`**
   - ✅ เปลี่ยน server_name จาก `dindinai.mfu.ac.th` เป็น `mfulearnai.mfu.ac.th`
   - Line 4: `server_name mfulearnai.mfu.ac.th;`

## ⚠️ Environment Variables ที่ต้องตั้งค่า

### Backend (.env)
```env
# CORS Configuration
ALLOWED_ORIGINS=https://mfulearnai.mfu.ac.th

# Frontend URL (for SAML redirects)
FRONTEND_URL=https://mfulearnai.mfu.ac.th
```

### Frontend (.env หรือ .env.production)
```env
VITE_API_URL=https://mfulearnai.mfu.ac.th/api
VITE_WS_URL=wss://mfulearnai.mfu.ac.th/ws
```

## 📝 หมายเหตุ

- **"DinDin"** ที่พบใน code เป็นชื่อ AI assistant (ไม่ใช่ domain) ไม่ต้องแก้
- **`config.apiUrl`** ใน frontend ใช้ environment variable (`VITE_API_URL`) ดังนั้นต้องตั้งค่าใน .env
- **SAML Configuration** อาจต้องอัปเดตใน IdP (Identity Provider) ถ้าใช้ SAML

## 🔍 Checklist สำหรับ Deployment

- [ ] ตั้งค่า `ALLOWED_ORIGINS` ใน backend .env
- [ ] ตั้งค่า `FRONTEND_URL` ใน backend .env
- [ ] ตั้งค่า `VITE_API_URL` ใน frontend .env
- [ ] ตั้งค่า `VITE_WS_URL` ใน frontend .env
- [ ] อัปเดต SAML configuration ใน IdP (ถ้าใช้)
- [ ] อัปเดต DNS records
- [ ] อัปเดต SSL certificates
- [ ] Restart services (backend, frontend, nginx)
- [ ] ทดสอบ CORS และ authentication flow

## 📋 ไฟล์ที่ตรวจสอบแล้ว (ไม่ต้องแก้)

- `frontend/src/config/config.tsx` - ใช้ environment variables (ไม่ต้องแก้)
- `backend/controllers/auth.controller.ts` - ใช้ `process.env.FRONTEND_URL` (ไม่ต้องแก้)
- `docker-compose.yml` - ไม่มี hardcoded domain
- `package.json` - ไม่มี domain references

---

**Status**: ✅ Domain references updated! ต้องตั้งค่า environment variables ใน production
