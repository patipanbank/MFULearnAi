# คู่มือการใช้งาน MFULearnAI (DinDin AI)

> เวอร์ชัน: 1.0.0 | วันที่: 27 กุมภาพันธ์ 2569  
> สำหรับ: นักศึกษา, อาจารย์, ผู้ดูแลระบบ มหาวิทยาลัยแม่ฟ้าหลวง

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [การเข้าสู่ระบบ](#2-การเข้าสู่ระบบ)
3. [หน้าหลัก — การสนทนากับ AI](#3-หน้าหลัก--การสนทนากับ-ai)
   - 3.1 [Sidebar — ประวัติการสนทนา](#31-sidebar--ประวัติการสนทนา)
   - 3.2 [กล่องพิมพ์ข้อความ (Chat Input)](#32-กล่องพิมพ์ข้อความ-chat-input)
   - 3.3 [การแนบไฟล์](#33-การแนบไฟล์)
   - 3.4 [การเลือก Knowledge Base](#34-การเลือก-knowledge-base)
   - 3.5 [การดูหลักฐาน (Evidence Viewer)](#35-การดูหลักฐาน-evidence-viewer)
4. [ฐานความรู้ (Knowledge Base)](#4-ฐานความรู้-knowledge-base)
   - 4.1 [การอัปโหลดเอกสาร](#41-การอัปโหลดเอกสาร)
   - 4.2 [การสร้าง Collection](#42-การสร้าง-collection)
   - 4.3 [การจัดการเอกสาร](#43-การจัดการเอกสาร)
5. [การตั้งค่าส่วนตัว](#5-การตั้งค่าส่วนตัว)
6. [แผงควบคุม Admin](#6-แผงควบคุม-admin)
   - 6.1 [Dashboard สถิติการใช้งาน](#61-dashboard-สถิติการใช้งาน)
   - 6.2 [การจัดการผู้ใช้](#62-การจัดการผู้ใช้)
   - 6.3 [การจัดการหน่วยงาน (Departments)](#63-การจัดการหน่วยงาน-departments)
   - 6.4 [System Prompts](#64-system-prompts)
   - 6.5 [API Keys](#65-api-keys)
   - 6.6 [Tool Access](#66-tool-access)
7. [สิทธิ์การใช้งานตามบทบาท](#7-สิทธิ์การใช้งานตามบทบาท)
8. [คำถามที่พบบ่อย (FAQ)](#8-คำถามที่พบบ่อย-faq)

---

## 1. ภาพรวมระบบ

**MFULearnAI (DinDin AI)** คือแพลตฟอร์ม AI สนทนา (Conversational AI) สำหรับมหาวิทยาลัยแม่ฟ้าหลวง ออกแบบมาเพื่อช่วยนักศึกษาและอาจารย์ในการเรียนรู้ วิจัย และทำงานได้อย่างมีประสิทธิภาพมากขึ้น โดยใช้เทคโนโลยี Large Language Model (LLM) ผ่าน AWS Bedrock

<!-- IMAGE: ภาพรวมสถาปัตยกรรมระบบแบบ diagram แสดง: Frontend (Vue) → Backend API → Bedrock LLM, Knowledge Base (ChromaDB), Auth (SSO/OAuth) 
     แนะนำ: สร้างเป็น architecture diagram แบบ flowchart หรือ block diagram -->

**ความสามารถหลัก:**

| ฟีเจอร์ | คำอธิบาย |
|---------|----------|
| 💬 AI Chat | สนทนาโต้ตอบกับ AI ได้อย่างต่อเนื่อง รองรับ Streaming |
| 📎 แนบไฟล์ | ส่งรูปภาพ, PDF, Excel, Word ได้ (สูงสุด 10 ไฟล์, 25 MB/ไฟล์) |
| 📚 Knowledge Base | อัปโหลดเอกสาร ให้ AI อ้างอิงข้อมูลเฉพาะขององค์กร |
| 🔍 Evidence Viewer | ดู PDF ต้นฉบับพร้อม highlight ส่วนที่ AI อ้างอิง |
| 🌙 Dark / Light Mode | ปรับธีมตามความชอบ |
| 🇹🇭 / 🇬🇧 ภาษา | สลับภาษาไทย / อังกฤษ |
| 🛡️ Admin Panel | จัดการผู้ใช้, สถิติ, prompt, เครื่องมือ |

---

## 2. การเข้าสู่ระบบ

### วิธีที่ 1 — SSO มหาวิทยาลัย (แนะนำ)

เข้าสู่ระบบด้วยบัญชี MFU (Microsoft / Google Workspace) ของมหาวิทยาลัยได้ทันที

<!-- IMAGE: ภาพหน้า Login แสดงปุ่ม "Login with MFU SSO" หรือ OAuth (Microsoft/Google) 
     แนะนำ: screenshot หน้า Login.vue ทั้งหน้า แสดงโลโก้ DinDin AI + ปุ่ม Login -->

**ขั้นตอน:**
1. เปิดเบราว์เซอร์ไปที่ URL ของระบบ
2. คลิกปุ่ม **"เข้าสู่ระบบด้วย MFU Account"**
3. ระบบจะ Redirect ไปหน้า MFU SSO
4. กรอก username/password ของมหาวิทยาลัย
5. หลังยืนยันตัวตนสำเร็จ ระบบจะพากลับมาที่หน้าหลัก

### วิธีที่ 2 — Local Account

สำหรับบัญชีที่ผู้ดูแลระบบสร้างให้โดยตรง:

<!-- IMAGE: ภาพ form Login แบบ Username + Password ที่อยู่ใน Login.vue 
     แนะนำ: screenshot เฉพาะส่วน form input username, password, ปุ่ม Login -->

1. กรอก **Username / Email**
2. กรอก **Password**
3. คลิก **"เข้าสู่ระบบ"**

> ⚠️ หากลืมรหัสผ่าน ให้ติดต่อผู้ดูแลระบบ (Admin) เพื่อ Reset

---

## 3. หน้าหลัก — การสนทนากับ AI

เมื่อเข้าสู่ระบบสำเร็จ ระบบจะแสดงหน้าสนทนา (Chat) ซึ่งประกอบด้วย 3 ส่วนหลัก:

<!-- IMAGE: ภาพรวม layout หน้า Chat ทั้งหน้า แบบ annotated screenshot มี label ชี้แต่ละส่วน:
     (A) Sidebar ซ้าย, (B) ส่วน Header, (C) พื้นที่ข้อความสนทนา, (D) กล่องพิมพ์ข้อความด้านล่าง, (E) Context Bar (Knowledge Selector) 
     แนะนำ: screenshot + Figma annotation หรือ draw.io overlay -->

| ส่วน | หน้าที่ |
|------|---------|
| **A — Sidebar** | ประวัติการสนทนา + ปุ่ม New Chat |
| **B — Header** | ชื่อระบบ + เมนู User |
| **C — Chat Area** | พื้นที่แสดงข้อความโต้ตอบ |
| **D — Input Bar** | พิมพ์ข้อความ / แนบไฟล์ / ส่ง |
| **E — Knowledge Bar** | เลือก Knowledge Base ที่จะให้ AI ใช้ |

---

### 3.1 Sidebar — ประวัติการสนทนา

<!-- IMAGE: ภาพ Sidebar ขยาย แสดงรายชื่อ session การสนทนา, ปุ่ม New Chat (บวก), ปุ่ม Delete (ถังขยะ)
     แนะนำ: screenshot เฉพาะ sidebar ตอน expand + hover state -->

**การใช้งาน Sidebar:**

- **เปิด/ปิด Sidebar** — คลิกไอคอน ☰ ที่มุมซ้ายบน หรือ hover เมาส์ที่ขอบซ้ายจอ (Desktop)
- **สนทนาใหม่** — คลิกปุ่ม **"+"** (New Chat) ที่ด้านบนของ Sidebar
- **เปิดการสนทนาเดิม** — คลิกที่ชื่อการสนทนาในรายการ
- **ลบการสนทนา** — hover ที่การสนทนา แล้วคลิกไอคอน 🗑️ จะมี popup ยืนยันก่อนลบ

> 💡 **Tip:** Sidebar จะยุบตัวอัตโนมัติเมื่อหน้าจอแคบ (Mobile) และเปิดได้จากปุ่ม ☰

---

### 3.2 กล่องพิมพ์ข้อความ (Chat Input)

<!-- IMAGE: ภาพ Chat Input bar แบบ close-up แสดง: textarea พิมพ์ข้อความ, ไอคอน Attach file (📎), ปุ่ม Send/Stop
     แนะนำ: screenshot + annotation ชี้แต่ละ element -->

**การส่งข้อความ:**
- พิมพ์ข้อความในกล่องแล้วกด **Enter** หรือคลิกปุ่ม **ส่ง** (▶)
- กด **Shift + Enter** เพื่อขึ้นบรรทัดใหม่โดยไม่ส่ง
- ขณะ AI กำลังตอบ ปุ่มจะเปลี่ยนเป็น **■ (Stop)** — คลิกเพื่อหยุดการสตรีม

**ข้อจำกัด:**
- ขนาดไฟล์สูงสุดต่อไฟล์: **25 MB**
- ขนาดรวมสูงสุด: **100 MB**
- จำนวนไฟล์สูงสุด: **10 ไฟล์** ต่อการส่ง 1 ครั้ง

---

### 3.3 การแนบไฟล์

ระบบรองรับการส่งไฟล์หลายประเภทพร้อมข้อความ:

<!-- IMAGE: ภาพแสดงตัวอย่าง attachment preview ใน Chat Input — แสดงการ์ดไฟล์ PDF, รูปภาพ thumbnail, Excel icon 
     แนะนำ: screenshot Chat Input ที่มีไฟล์แนบอยู่ ก่อนกดส่ง -->

| ประเภทไฟล์ | ไอคอน | หมายเหตุ |
|-----------|-------|---------|
| รูปภาพ (JPG, PNG, WebP, GIF) | 🖼️ | AI วิเคราะห์รูปภาพได้ |
| PDF | 📄 | AI อ่านเนื้อหาจาก PDF |
| Excel / CSV | 📊 | วิเคราะห์ข้อมูลตาราง |
| Word (.docx) | 📝 | อ่านเอกสาร Word |
| ไฟล์ทั่วไป | 📁 | ขึ้นอยู่กับ Model ที่เลือก |

**วิธีแนบไฟล์:**
1. คลิกไอคอน **📎** ในกล่องพิมพ์
2. เลือกไฟล์จาก File Explorer หรือ **ลากวาง (Drag & Drop)** ลงในกล่องพิมพ์
3. สามารถ **วาง (Paste)** รูปภาพจาก Clipboard ได้โดยตรง (Ctrl+V)
4. ไฟล์จะแสดงเป็น Card preview ก่อนส่ง — คลิก **×** เพื่อลบออก

---

### 3.4 การเลือก Knowledge Base

Knowledge Base คือชุดเอกสารที่อัปโหลดไว้ในระบบ เมื่อเลือกแล้ว AI จะค้นหาข้อมูลจากเอกสารเหล่านั้นก่อนตอบ (RAG — Retrieval-Augmented Generation)

<!-- IMAGE: ภาพ Context Bar ที่อยู่เหนือ Chat Input — แสดง Dropdown/Selector เลือก Knowledge Base, สถานะ "Selected: ชื่อ KB"
     แนะนำ: screenshot ส่วน KnowledgeSelector.vue ทั้ง state: ไม่ได้เลือก และ เลือกแล้ว -->

**ขั้นตอน:**
1. ดูแถบ **Knowledge Base** ที่อยู่เหนือกล่องพิมพ์
2. คลิก Dropdown เพื่อเลือก Collection / ชุดเอกสาร ที่ต้องการ
3. เมื่อเลือกแล้ว AI จะตอบโดยอ้างอิงจากเอกสารในชุดนั้น
4. คลิก **✕** หรือเลือก "ไม่ใช้ Knowledge Base" เพื่อยกเลิก

> 💡 เมื่อ AI ตอบโดยอ้างอิงเอกสาร จะมีเครื่องหมาย 📄 แสดงที่ข้อความ — คลิกเพื่อดูหลักฐาน

---

### 3.5 การดูหลักฐาน (Evidence Viewer)

เมื่อ AI ตอบโดยดึงข้อมูลจาก Knowledge Base ระบบจะแสดง **Evidence** ที่ชี้ไปยังหน้าและตำแหน่งใน PDF ต้นฉบับ

<!-- IMAGE: ภาพ Split View แสดง: ซ้าย = Chat Message พร้อม citation badge, ขวา = PDF Viewer แสดงหน้าที่อ้างอิง + highlight สีเหลือง
     แนะนำ: screenshot จริงของ Evidence Viewer หรือ mockup แสดง 2 panel -->

**การใช้งาน:**
1. คลิกที่ป้าย Citation (เช่น `[1]` หรือไอคอน 📄) บนข้อความที่ AI ตอบ
2. แผง **PDF Viewer** จะเปิดทางขวา แสดงไฟล์ PDF ต้นฉบับ
3. ระบบจะ Scroll ไปยังหน้าที่อ้างอิงโดยอัตโนมัติ พร้อม Highlight ข้อความ
4. คลิกปุ่ม **✕** หรือคลิกพื้นที่ด้านซ้ายเพื่อปิด Viewer

---

## 4. ฐานความรู้ (Knowledge Base)

เมนู **Knowledge Base** ใช้สำหรับจัดการเอกสารที่ให้ AI อ้างอิง ผู้ใช้สามารถอัปโหลดไฟล์และสร้าง Collection เพื่อจัดกลุ่มเอกสาร

**การเข้าถึง:** คลิกเมนู (☰ หรืออวาตาร์) → **Knowledge Base**

<!-- IMAGE: ภาพหน้า KnowledgeDashboard.vue ทั้งหน้า แสดง Tab "Knowledge" และ "Collections", รายการเอกสาร, ปุ่ม Upload
     แนะนำ: screenshot ทั้งหน้า annotate แสดง Tab switcher, grid/list view, action buttons -->

---

### 4.1 การอัปโหลดเอกสาร

<!-- IMAGE: ภาพ Upload Modal (UploadModal.vue) แสดง Drag & Drop zone, รายการไฟล์ที่เลือก, dropdown เลือก Collection, progress bar อัปโหลด
     แนะนำ: screenshot modal step-by-step หรือ 2 ภาพ (ก่อน/หลังเลือกไฟล์) -->

1. คลิกปุ่ม **"+ อัปโหลดเอกสาร"** 
2. Modal อัปโหลดจะปรากฏ
3. **ลากวางไฟล์** หรือคลิก **"เลือกไฟล์"** เพื่อเลือกจาก File Explorer
4. เลือก **Collection** ที่ต้องการจัดเก็บ (ถ้ามี)
5. คลิก **"อัปโหลด"** — ระบบจะประมวลผลและ Index เอกสาร
6. เมื่อสถานะเปลี่ยนเป็น ✅ **Ready** เอกสารพร้อมใช้งานแล้ว

**ไฟล์ที่รองรับ:** PDF, DOCX, TXT, MD, CSV, XLSX

> ⚠️ เอกสารที่อัปโหลดอาจต้องรอผู้ดูแลระบบ **อนุมัติ** ก่อนจึงจะปรากฏใน Knowledge Base (ขึ้นอยู่กับการตั้งค่า)

---

### 4.2 การสร้าง Collection

Collection คือโฟลเดอร์สำหรับจัดกลุ่มเอกสาร เช่น "รายวิชา CS101" หรือ "ระเบียบมหาวิทยาลัย"

<!-- IMAGE: ภาพ Create Collection Modal (CreateCollectionModal.vue) แสดง input ชื่อ Collection, คำอธิบาย, ปุ่ม Create
     แนะนำ: screenshot modal ที่กรอกข้อมูลแล้ว -->

1. ไปที่แท็บ **"Collections"**
2. คลิกปุ่ม **"+ สร้าง Collection"**
3. กรอก **ชื่อ Collection** และ **คำอธิบาย** (ถ้ามี)
4. คลิก **"สร้าง"**
5. Collection ใหม่จะปรากฏใน Grid

---

### 4.3 การจัดการเอกสาร

<!-- IMAGE: ภาพ KnowledgeDetailModal.vue แสดงรายละเอียดเอกสาร: ชื่อไฟล์, สถานะ, วันที่, ปุ่ม Download/Delete
     แนะนำ: screenshot modal detail -->

- **ดูรายละเอียด** — คลิกบัตรเอกสารเพื่อเปิด Detail Modal
- **ลบเอกสาร** — ใน Detail Modal คลิกปุ่ม **"ลบ"** (ต้องยืนยันก่อน)
- **ดูสถานะ** — แต่ละเอกสารมีสถานะ: `Processing` → `Ready` / `Failed`

| สถานะ | ความหมาย |
|-------|---------|
| ⏳ Processing | ระบบกำลัง Index เอกสาร |
| ✅ Ready | พร้อมใช้งาน |
| ❌ Failed | เกิดข้อผิดพลาด ลองอัปโหลดใหม่ |
| 🕐 Pending | รอ Admin อนุมัติ |

---

## 5. การตั้งค่าส่วนตัว

เข้าถึงเมนูตั้งค่าได้จาก **อวาตาร์** มุมขวาบน หรือ **ไอคอน ☰** บน Sidebar

<!-- IMAGE: ภาพ SettingsMenu.vue (side panel/overlay) แสดงรายการเมนู: AI Chat, Knowledge Base, Admin section (ถ้าเป็น admin), Theme toggle, Language toggle, Logout
     แนะนำ: screenshot เมนูที่เปิดอยู่ พร้อม annotation ชี้แต่ละ item -->

| การตั้งค่า | วิธีใช้ |
|-----------|--------|
| **🌙 Dark / Light Mode** | คลิก Toggle สลับธีมมืด/สว่าง |
| **🇹🇭 / 🇬🇧 ภาษา** | คลิก Toggle สลับ ไทย/อังกฤษ |
| **🚪 ออกจากระบบ** | คลิก "Logout" — ระบบจะขอยืนยันก่อน |

---

## 6. แผงควบคุม Admin

> เฉพาะผู้ใช้ที่มีบทบาท **Admin** หรือ **Superadmin** เท่านั้น

เข้าถึงจาก Settings Menu → หัวข้อ **Admin**

---

### 6.1 Dashboard สถิติการใช้งาน

<!-- IMAGE: ภาพ AdminDashboard.vue ทั้งหน้า แสดง: 4 Stat Cards (Total Tokens, Tokens Today, Active Users, Total Requests), Line Chart (Usage Trend), Chart อื่นๆ
     แนะนำ: screenshot เต็มหน้า + zoom-in stat cards แยกอีกภาพ -->

หน้า Dashboard แสดงสถิติการใช้งานระบบ:

**Stat Cards (4 การ์ดสรุป):**
| การ์ด | ข้อมูล |
|------|-------|
| 🪙 Total Tokens (All Time) | Token ที่ใช้ทั้งหมดตลอดการใช้งาน |
| 📅 Tokens Today | Token ที่ใช้วันนี้ |
| 👥 Active Users Today | จำนวน User ที่ใช้งานวันนี้ |
| 🔄 Total Requests Today | จำนวน Request ทั้งหมดวันนี้ |

**Charts:**
- **Usage Trend** — กราฟเส้นแสดงแนวโน้มการใช้งานรายวัน
- กราฟอื่นๆ ตามที่ Config ไว้

**ปุ่ม Refresh** (🔄) ที่มุมขวาบน — คลิกเพื่อโหลดข้อมูลใหม่

---

### 6.2 การจัดการผู้ใช้

**เส้นทาง:** Admin Menu → **Users & Admins**

<!-- IMAGE: ภาพ AdminUsers.vue แสดงตาราง User มีคอลัมน์: User (ชื่อ+อีเมล), Role badge, Department, Status (Active/Inactive), วันที่ลงทะเบียน + Filter buttons (All/Superadmin/Admin/Teacher/Student)
     แนะนำ: screenshot ตารางที่มีข้อมูล + zoom Filter buttons -->

**ฟีเจอร์หลัก:**

- **ค้นหา/กรอง** — คลิกปุ่ม Filter เพื่อกรองตาม Role: `All` / `Superadmin` / `Admin` / `Teacher` / `Student`
- **ดู/แก้ไขผู้ใช้** — คลิกแถว User เพื่อเปิด Edit Modal
- **สร้าง User ใหม่** (เฉพาะ Superadmin) — คลิกปุ่ม **"+ Create User"**

**บทบาทที่มีในระบบ:**

| บทบาท | สิทธิ์โดยย่อ |
|-------|------------|
| `superadmin` | สิทธิ์สูงสุด จัดการได้ทุกอย่าง |
| `admin` | จัดการ User, ดู Dashboard, อนุมัติ Knowledge |
| `teacher` | ใช้ AI Chat, จัดการ Knowledge Base ของตัวเอง |
| `student` | ใช้ AI Chat, อัปโหลดเอกสาร (รอการอนุมัติ) |

<!-- IMAGE: ภาพ Edit/Create User Modal แสดง form: ชื่อ-นามสกุล, Email, Role dropdown, Department, Active toggle
     แนะนำ: screenshot modal state Edit -->

---

### 6.3 การจัดการหน่วยงาน (Departments)

**เส้นทาง:** Admin Menu → **Departments**

<!-- IMAGE: ภาพ AdminDepartments.vue แสดงรายชื่อหน่วยงาน (คณะ/สำนัก), ปุ่ม Add/Edit/Delete
     แนะนำ: screenshot หน้า Departments -->

ใช้สำหรับสร้างและจัดการรายชื่อหน่วยงาน/คณะ เพื่อใช้ classify ผู้ใช้ระบบ

- **เพิ่มหน่วยงาน** — คลิก **"+ Add Department"**
- **แก้ไข** — คลิกปุ่มแก้ไขที่แถวหน่วยงาน
- **ลบ** — คลิกปุ่มลบ (ต้องยืนยัน)

---

### 6.4 System Prompts

**เส้นทาง:** Admin Menu → **System Prompts**

<!-- IMAGE: ภาพ AdminPrompts.vue แสดง 2 panel: ซ้าย = รายการ Prompt (sidebar list พร้อม badge PROD/TEST), ขวา = Text Editor พร้อม Toolbar (Save/Reset)
     แนะนำ: screenshot ทั้งหน้าแบบ split view -->

System Prompt คือคำสั่งพฤติกรรมเริ่มต้นที่ให้กับ AI ก่อนผู้ใช้จะพิมพ์

**การแก้ไข Prompt (เฉพาะ Superadmin):**
1. เลือก Prompt จากรายการซ้าย (แต่ละรายการมี badge `PROD` / `TEST`)
2. แก้ไขเนื้อหาใน Editor ด้านขวา
3. คลิก **"Save Changes"** เพื่อบันทึก หรือ **"Reset"** เพื่อยกเลิกการเปลี่ยนแปลง

> ⚠️ Prompt ที่มี badge **PROD** ส่งผลต่อการใช้งานจริงในระบบ ควรระวังในการแก้ไข

---

### 6.5 API Keys

**เส้นทาง:** Admin Menu → **API Keys**

<!-- IMAGE: ภาพ AdminApiKeys.vue แสดงรายการ API Keys (masked), ปุ่ม Create/Revoke, วันหมดอายุ
     แนะนำ: screenshot ตาราง API Keys -->

ใช้สำหรับออก API Key ให้กับระบบภายนอกที่ต้องการเชื่อมต่อกับ MFULearnAI

- **สร้าง Key ใหม่** — คลิก **"+ Create API Key"** (Key จะแสดงครั้งเดียว — ต้องบันทึกทันที)
- **ยกเลิก Key** — คลิก **"Revoke"** ที่แถว Key ที่ต้องการลบ

---

### 6.6 Tool Access

**เส้นทาง:** Admin Menu → **Tool Access**

<!-- IMAGE: ภาพ AdminToolAccess.vue แสดงรายการ Tools (เช่น Web Search, Calculator ฯลฯ) พร้อม Toggle เปิด/ปิด ต่อ Role หรือ User
     แนะนำ: screenshot ตาราง Tool Access matrix -->

ใช้ควบคุมว่า User กลุ่มใดสามารถเข้าถึงเครื่องมือ (Tools) พิเศษของ AI ได้บ้าง เช่น Web Search, Code Interpreter, Calculator

---

## 7. สิทธิ์การใช้งานตามบทบาท

ตารางสรุปความสามารถของแต่ละ Role:

| ฟีเจอร์ | Student | Teacher | Admin | Superadmin |
|---------|---------|---------|-------|-----------|
| ใช้ AI Chat | ✅ | ✅ | ✅ | ✅ |
| แนบไฟล์ใน Chat | ✅ | ✅ | ✅ | ✅ |
| อัปโหลดเอกสาร | ✅ (รออนุมัติ) | ✅ | ✅ | ✅ |
| สร้าง Collection | ✅ | ✅ | ✅ | ✅ |
| อนุมัติเอกสาร | ❌ | ❌ | ✅ | ✅ |
| ดู Dashboard | ❌ | ❌ | ✅ | ✅ |
| จัดการ Users | ❌ | ❌ | ✅ (จำกัด) | ✅ |
| สร้าง User | ❌ | ❌ | ❌ | ✅ |
| แก้ไข System Prompt | ❌ | ❌ | ❌ | ✅ |
| จัดการ API Keys | ❌ | ❌ | ❌ | ✅ |
| จัดการ Tool Access | ❌ | ❌ | ❌ | ✅ |

---

## 8. คำถามที่พบบ่อย (FAQ)

**Q: AI ตอบช้ามากหรือไม่ตอบ ทำอย่างไร?**  
A: คลิกปุ่ม **■ Stop** แล้วลองส่งข้อความใหม่ หากยังไม่ได้ผล รีเฟรชหน้าเว็บ

**Q: ไฟล์ที่อัปโหลดขึ้น Knowledge Base ไม่ปรากฏ ทำไม?**  
A: อาจอยู่ในสถานะ `Processing` หรือ `Pending` รอสักครู่ หรือติดต่อ Admin เพื่ออนุมัติ

**Q: ทำไม AI ไม่อ้างอิงเอกสารที่ฉันอัปโหลด?**  
A: ตรวจสอบว่าได้เลือก Knowledge Base ใน Context Bar เหนือกล่องพิมพ์แล้ว และเอกสารมีสถานะ `Ready`

**Q: ลืมรหัสผ่านทำอย่างไร?**  
A: ติดต่อ Admin ของระบบเพื่อ Reset รหัสผ่าน หากใช้ SSO ให้ติดต่อ IT ของมหาวิทยาลัย

**Q: สามารถใช้บนมือถือได้ไหม?**  
A: ได้ ระบบรองรับ Responsive Design สำหรับ Mobile Browser Sidebar จะยุบตัวและเปิดได้จากปุ่ม ☰

**Q: ข้อมูลการสนทนาถูกเก็บไว้นานแค่ไหน?**  
A: ขึ้นอยู่กับนโยบายของมหาวิทยาลัย ผู้ใช้สามารถลบประวัติสนทนาได้เองจาก Sidebar

---

## ภาคผนวก — รายการภาพที่ต้องถ่าย/สร้าง

| # | ภาพ | ส่วนที่ใช้ | ประเภทภาพแนะนำ |
|---|-----|-----------|----------------|
| 1 | Architecture Diagram ระบบ | §1 ภาพรวม | Block diagram / draw.io |
| 2 | หน้า Login ทั้งหน้า | §2 Login | Screenshot จริง |
| 3 | หน้า Login — Form credential | §2 Local Account | Screenshot crop |
| 4 | Layout Chat ทั้งหน้า พร้อม annotation A-E | §3 หน้าหลัก | Screenshot + Figma annotation |
| 5 | Sidebar expand + รายการ session | §3.1 Sidebar | Screenshot |
| 6 | Chat Input bar + annotation | §3.2 Chat Input | Screenshot |
| 7 | Attachment preview cards | §3.3 ไฟล์แนบ | Screenshot |
| 8 | Knowledge Selector bar (2 state) | §3.4 Knowledge Bar | Screenshot x2 |
| 9 | Evidence Viewer split screen | §3.5 Evidence | Screenshot |
| 10 | KnowledgeDashboard ทั้งหน้า | §4 Knowledge Base | Screenshot |
| 11 | Upload Modal + drag-drop zone | §4.1 อัปโหลด | Screenshot modal |
| 12 | Create Collection Modal | §4.2 Collection | Screenshot modal |
| 13 | Knowledge Detail Modal | §4.3 จัดการ | Screenshot modal |
| 14 | Settings Menu/Panel เปิดอยู่ | §5 ตั้งค่า | Screenshot overlay |
| 15 | AdminDashboard ทั้งหน้า | §6.1 Dashboard | Screenshot |
| 16 | Stat Cards zoom-in | §6.1 Dashboard | Screenshot crop |
| 17 | AdminUsers ตาราง + Filter | §6.2 Users | Screenshot |
| 18 | Edit/Create User Modal | §6.2 Users | Screenshot modal |
| 19 | AdminDepartments | §6.3 Departments | Screenshot |
| 20 | AdminPrompts split view | §6.4 Prompts | Screenshot |
| 21 | AdminApiKeys ตาราง | §6.5 API Keys | Screenshot |
| 22 | AdminToolAccess matrix | §6.6 Tools | Screenshot |

---

*คู่มือนี้จัดทำโดยทีมพัฒนา MFULearnAI — มหาวิทยาลัยแม่ฟ้าหลวง*
