@echo off
echo ===================================
echo MFU Learn AI - Admin Creator
echo ===================================
echo.

REM ตั้งค่า environment variable สำหรับ MongoDB
set MONGODB_URI=mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin

REM ตรวจสอบว่ามี Docker containers ทำงานอยู่หรือไม่
echo กำลังตรวจสอบ Docker containers...
docker ps > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker ไม่ทำงาน กรุณา start Docker Desktop ก่อน
    echo.
    pause
    exit /b 1
)

REM ตรวจสอบว่า MongoDB container ทำงานอยู่หรือไม่
docker ps --filter "name=mfulearnai_db" --filter "status=running" | findstr mfulearnai_db > nul
if %errorlevel% neq 0 (
    echo ❌ MongoDB container ไม่ทำงาน
    echo กำลังเริ่ม Docker containers...
    docker-compose up -d
    echo รอให้ services เริ่มทำงาน...
    timeout /t 10 > nul
)

echo ✅ MongoDB container พร้อมใช้งาน
echo.

REM รัน Python script
echo กำลังเริ่ม Admin Creator...
echo.
python create_admin.py

if %errorlevel% neq 0 (
    echo.
    echo ❌ เกิดข้อผิดพลาดในการรัน script
) else (
    echo.
    echo ✅ Admin Creator จบการทำงานแล้ว
)

echo.
pause 