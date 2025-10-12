# คำขอแก้ไข Load Balancer Configuration

**เรียน:** IT Admin ผู้ดูแล Load Balancer (10.1.4.6 / lb.mfu.ac.th)

**วันที่:** 12 ตุลาคม 2568

**เรื่อง:** ขอแก้ไข NGINX configuration สำหรับ mfulearnai.mfu.ac.th เพื่อแก้ปัญหา redirect loop

---

## สาเหตุของปัญหา

ปัจจุบัน mfulearnai.mfu.ac.th มีปัญหา **redirect loop (HTTP 301)** เนื่องจาก:

- Load Balancer proxy ไปที่ `https://10.1.44.204:8443` (Kubernetes Ingress HTTPS port)
- Kubernetes Ingress ทำ SSL redirect ซ้ำ → เกิด infinite loop

## วิธีแก้ไข

ขอความกรุณาแก้ไข NGINX configuration สำหรับ **mfulearnai.mfu.ac.th** บน Load Balancer ดังนี้:

### เปลี่ยนจาก:
```nginx
location / {
    proxy_pass https://10.1.44.204:8443;
    proxy_ssl_verify off;
    # ...
}
```

### เป็น:
```nginx
location / {
    proxy_pass https://10.1.44.204:443;
    proxy_ssl_verify off;
    # ...
}
```

**หรือถ้าไม่ต้องการ SSL between load balancer and app server:**
```nginx
location / {
    proxy_pass http://10.1.44.204:443;
    # ...
}
```

## เหตุผล

1. Application server (10.1.44.204) ได้ย้ายจาก Kubernetes Ingress port 8443 มาใช้ Host NGINX port 443
2. Host NGINX รับผิดชอบ SSL termination และ proxy ไปยัง services ภายใน
3. การเปลี่ยนแปลงนี้ป้องกัน SSL redirect ซ้ำซ้อน

## ขั้นตอนการแก้ไข

```bash
# 1. Backup config เดิม
sudo cp /etc/nginx/sites-available/mfulearnai.mfu.ac.th \
       /etc/nginx/sites-available/mfulearnai.mfu.ac.th.backup

# 2. แก้ไขไฟล์
sudo nano /etc/nginx/sites-available/mfulearnai.mfu.ac.th

# 3. เปลี่ยน port 8443 → 443

# 4. ทดสอบ config
sudo nginx -t

# 5. Reload NGINX
sudo systemctl reload nginx
```

## การทดสอบ

หลังแก้ไขแล้ว ทดสอบด้วย:

```bash
curl -IL https://mfulearnai.mfu.ac.th | grep -E '(HTTP|Location)' | head -5
```

**ผลลัพธ์ที่ต้องการ:**
```
HTTP/2 200 OK
```

**ไม่ใช่:**
```
HTTP/2 301 (loop 50 ครั้ง)
```

## ข้อมูลติดต่อ

- **ผู้ประสานงาน:** patipanbank
- **Server:** 10.1.44.204 (mfulearnai-ThinkStation-P2-Tower)
- **Load Balancer:** 10.1.4.6 (lb.mfu.ac.th)
- **Domain:** mfulearnai.mfu.ac.th

## สถาปัตยกรรมปัจจุบัน

```
User
  ↓ HTTPS
Load Balancer (10.1.4.6)
  ↓ HTTPS:443 (แก้ใหม่)
Host NGINX (10.1.44.204:443)
  ├→ /api/* → Kubernetes microservices (localhost:8080)
  ├→ /ws → Kubernetes WebSocket (localhost:8080)
  └→ / → Frontend (Docker Compose localhost:3002)
```

## หมายเหตุ

- การเปลี่ยนแปลงนี้ไม่กระทบ services อื่นบน load balancer
- แก้ไขเฉพาะ config ของ mfulearnai.mfu.ac.th เท่านั้น
- สามารถ rollback ได้ทันทีถ้ามีปัญหา

---

**ขอบคุณครับ**

_Generated with assistance from Claude Code_
