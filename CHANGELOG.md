# Changelog

## 2025-01-09 - แก้ไขปัญหา API Routing และ Metrics Configuration

### ปัญหาที่พบจาก Logs
- Frontend เรียก API ไปที่ `/api/auth/me` แต่ Backend ใช้ versioning `/v1/`
- Prometheus พยายาม scrape `/metrics` แต่ไม่มี endpoint นี้
- ผลลัพธ์: HTTP 404 errors สำหรับ API calls และ Prometheus metrics

### การแก้ไข
1. **แก้ไข API Versioning (docker-compose.yml)**
   - เปลี่ยน `VITE_API_URL` จาก `${FRONTEND_URL}/api` เป็น `${FRONTEND_URL}/api/v1`
   - ทำให้ Frontend เรียก API ที่ path ถูกต้อง

2. **สร้าง Metrics Controller ใหม่**
   - สร้าง `MetricsController` ในไฟล์ `backend/src/infrastructure/monitoring/metrics.controller.ts`
   - ไม่ต้อง authentication สำหรับ Prometheus
   - ให้ metrics ในรูปแบบ Prometheus format

3. **อัพเดท Prometheus Configuration**
   - ใน `monitoring/prometheus.yml` ใช้ `metrics_path: '/metrics'`
   - ทำให้ Prometheus สามารถ scrape metrics ได้

### ผลลัพธ์
- Frontend สามารถเรียก API ได้ปกติ (`/api/v1/auth/me`)
- Prometheus สามารถ scrape metrics ได้ (`/metrics`)
- ลดข้อผิดพลาด 404 errors ในระบบ

### ไฟล์ที่แก้ไข
- `docker-compose.yml` - เปลี่ยน VITE_API_URL
- `backend/src/infrastructure/monitoring/metrics.controller.ts` - สร้างใหม่
- `backend/src/infrastructure/monitoring/monitoring.module.ts` - เพิ่ม MetricsController
- `monitoring/prometheus.yml` - อัพเดท metrics_path 