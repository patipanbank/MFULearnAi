#!/usr/bin/env python3
"""
Script สำหรับสร้าง Admin User ใหม่
Usage: python create_admin.py
"""

import asyncio
import sys
import os
from getpass import getpass

# เพิ่ม backend directory ให้ Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from lib.mongodb import connect_to_mongo, close_mongo_connection
from services.user_service import user_service
from models.user import UserRole

async def create_admin_interactive():
    """สร้าง admin user แบบ interactive"""
    print("=== MFU Learn AI - Admin User Creation ===")
    print()
    
    # รับข้อมูลจาก user
    username = input("Username: ").strip()
    if not username:
        print("❌ Username จำเป็นต้องใส่")
        return False
    
    # ตรวจสอบว่า username มีอยู่แล้วหรือไม่
    existing_user = await user_service.find_admin_by_username(username)
    if existing_user:
        print(f"❌ Username '{username}' มีอยู่แล้ว")
        return False
    
    password = getpass("Password: ").strip()
    if not password:
        print("❌ Password จำเป็นต้องใส่")
        return False
    
    confirm_password = getpass("Confirm Password: ").strip()
    if password != confirm_password:
        print("❌ Password ไม่ตรงกัน")
        return False
    
    email = input("Email: ").strip()
    if not email:
        print("❌ Email จำเป็นต้องใส่")
        return False
    
    first_name = input("First Name: ").strip()
    if not first_name:
        print("❌ First Name จำเป็นต้องใส่")
        return False
    
    last_name = input("Last Name: ").strip()
    if not last_name:
        print("❌ Last Name จำเป็นต้องใส่")
        return False
    
    department = input("Department: ").strip()
    if not department:
        print("❌ Department จำเป็นต้องใส่")
        return False
    
    # แสดงข้อมูลที่จะสร้าง
    print("\n=== ข้อมูล Admin ที่จะสร้าง ===")
    print(f"Username: {username}")
    print(f"Email: {email}")
    print(f"Name: {first_name} {last_name}")
    print(f"Department: {department}")
    print(f"Role: {UserRole.ADMIN}")
    print()
    
    confirm = input("ยืนยันการสร้าง Admin? (y/N): ").strip().lower()
    if confirm not in ['y', 'yes']:
        print("❌ ยกเลิกการสร้าง Admin")
        return False
    
    try:
        # สร้าง admin user โดยตรงโดยไม่ผ่าน create_admin method
        from lib.mongodb import get_database
        from utils.security import get_password_hash
        from datetime import datetime
        from bson import ObjectId
        
        db = get_database()
        
        # ตรวจสอบ username ซ้ำอีกครั้ง
        if await db.get_collection("users").find_one({"username": username}):
            print(f"❌ Username '{username}' มีอยู่แล้ว")
            return False
        
        # สร้าง admin document
        hashed_password = get_password_hash(password)
        admin_doc = {
            "_id": ObjectId(),
            "nameID": username,
            "username": username,
            "password": hashed_password,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "department": department,
            "role": UserRole.ADMIN,
            "groups": ['Admin'],
            "created": datetime.utcnow(),
            "updated": datetime.utcnow()
        }
        
        # Insert เข้าฐานข้อมูล
        await db.get_collection("users").insert_one(admin_doc)
        
        print("\n✅ สร้าง Admin สำเร็จ!")
        print(f"ID: {str(admin_doc['_id'])}")
        print(f"Username: {admin_doc['username']}")
        print(f"Email: {admin_doc['email']}")
        print(f"Name: {admin_doc['firstName']} {admin_doc['lastName']}")
        print(f"Department: {admin_doc['department']}")
        print(f"Role: {admin_doc['role']}")
        print(f"Created: {admin_doc['created']}")
        
        return True
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {str(e)}")
        return False

async def create_super_admin():
    """สร้าง Super Admin แรก (ใช้เมื่อยังไม่มี admin ในระบบ)"""
    print("=== สร้าง Super Admin แรก ===")
    print("⚠️  ฟังก์ชันนี้ใช้เมื่อยังไม่มี admin ในระบบ")
    print()
    
    # ตรวจสอบว่ามี admin อยู่แล้วหรือไม่
    existing_admins = await user_service.get_all_admins()
    if existing_admins:
        print(f"❌ มี Admin อยู่แล้ว {len(existing_admins)} คน")
        print("ใช้โหมดปกติแทน")
        return False
    
    username = input("Super Admin Username: ").strip() or "superadmin"
    password = getpass("Super Admin Password: ").strip()
    if not password:
        password = "SuperAdmin123!"  # default password
        print(f"ใช้ password เริ่มต้น: {password}")
    
    email = input("Super Admin Email: ").strip() or "superadmin@mfu.ac.th"
    
    try:
        from lib.mongodb import get_database
        from utils.security import get_password_hash
        from datetime import datetime
        from bson import ObjectId
        
        db = get_database()
        
        # สร้าง Super Admin โดยตรง
        super_admin_doc = {
            "_id": ObjectId(),
            "nameID": username,
            "username": username,
            "password": get_password_hash(password),
            "email": email,
            "firstName": "Super",
            "lastName": "Admin",
            "department": "IT",
            "role": UserRole.SUPER_ADMIN,
            "groups": ['SuperAdmin', 'Admin'],
            "created": datetime.utcnow(),
            "updated": datetime.utcnow()
        }
        
        await db.get_collection("users").insert_one(super_admin_doc)
        
        print("\n✅ สร้าง Super Admin สำเร็จ!")
        print(f"Username: {username}")
        print(f"Password: {password}")
        print(f"Email: {email}")
        print(f"Role: {UserRole.SUPER_ADMIN}")
        print()
        print("⚠️  กรุณาเปลี่ยน password หลังจาก login ครั้งแรก")
        
        return True
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {str(e)}")
        return False

async def list_admins():
    """แสดงรายชื่อ admin ทั้งหมด"""
    print("=== รายชื่อ Admin ทั้งหมด ===")
    
    try:
        admins = await user_service.get_all_admins()
        
        if not admins:
            print("❌ ไม่มี Admin ในระบบ")
            return
        
        print(f"พบ Admin จำนวน {len(admins)} คน:")
        print()
        print(f"{'ID':<25} {'Username':<20} {'Name':<30} {'Department':<20} {'Role':<15}")
        print("-" * 110)
        
        for admin in admins:
            full_name = f"{admin.firstName or ''} {admin.lastName or ''}".strip()
            print(f"{admin.id:<25} {admin.username:<20} {full_name:<30} {admin.department or 'N/A':<20} {admin.role:<15}")
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {str(e)}")

async def main():
    """Main function"""
    try:
        # เชื่อมต่อฐานข้อมูล
        await connect_to_mongo()
        print("✅ เชื่อมต่อฐานข้อมูลสำเร็จ")
        print()
        
        # เมนูหลัก
        while True:
            print("=== MFU Learn AI - Admin Management ===")
            print("1. สร้าง Admin ใหม่")
            print("2. แสดงรายชื่อ Admin")
            print("3. สร้าง Super Admin (ใช้เมื่อไม่มี admin)")
            print("4. ออกจากโปรแกรม")
            print()
            
            choice = input("เลือกเมนู (1-4): ").strip()
            
            if choice == "1":
                await create_admin_interactive()
            elif choice == "2":
                await list_admins()
            elif choice == "3":
                await create_super_admin()
            elif choice == "4":
                print("👋 ออกจากโปรแกรม")
                break
            else:
                print("❌ กรุณาเลือก 1-4")
            
            print("\n" + "="*50 + "\n")
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: {str(e)}")
        return False
    
    finally:
        # ปิดการเชื่อมต่อฐานข้อมูล
        await close_mongo_connection()
        print("✅ ปิดการเชื่อมต่อฐานข้อมูลแล้ว")

if __name__ == "__main__":
    # ตรวจสอบว่าอยู่ใน project directory
    if not os.path.exists("backend"):
        print("❌ กรุณารันสคริปต์ในโฟลเดอร์ root ของโปรเจค")
        sys.exit(1)
    
    # รัน script
    asyncio.run(main()) 