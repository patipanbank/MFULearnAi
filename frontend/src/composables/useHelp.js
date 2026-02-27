import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLanguage } from '@/composables/useSettings'

/**
 * useHelp — returns contextual help content based on the current route.
 * Each page has a `title` and `sections[]`, each section has a `heading` and `items[]`.
 * Items are { text: string } bullet points, or { key, desc } shortcut rows.
 */
export function useHelp() {
  const route = useRoute()
  const { lang } = useLanguage()

  // ─── Content DB ────────────────────────────────────────────────
  const content = computed(() => {
    const isTh = lang.value === 'th'
    const path = route.path

    // ── Chat ────────────────────────────────────────────────────
    if (path.startsWith('/chat')) {
      return {
        title: isTh ? 'วิธีใช้ AI Chat' : 'How to use AI Chat',
        sections: [
          {
            heading: isTh ? 'การส่งข้อความ' : 'Sending Messages',
            items: [
              { text: isTh ? 'พิมพ์ข้อความแล้วกด Enter หรือปุ่ม ▶ เพื่อส่ง' : 'Type a message and press Enter or ▶ to send' },
              { text: isTh ? 'กด Shift+Enter เพื่อขึ้นบรรทัดใหม่โดยไม่ส่ง' : 'Press Shift+Enter for a new line without sending' },
              { text: isTh ? 'คลิก ■ เพื่อหยุด AI ขณะกำลังตอบ' : 'Click ■ to stop AI while it is streaming' },
            ]
          },
          {
            heading: isTh ? 'การแนบไฟล์' : 'Attaching Files',
            items: [
              { text: isTh ? 'คลิก 📎 หรือลากวางไฟล์ลงกล่องพิมพ์' : 'Click 📎 or drag & drop files into the input box' },
              { text: isTh ? 'วาง (Ctrl+V) รูปภาพจาก Clipboard ได้ทันที' : 'Paste (Ctrl+V) an image from clipboard directly' },
              { text: isTh ? 'รองรับ PDF, รูปภาพ, Excel, Word (สูงสุด 10 ไฟล์ / 25 MB ต่อไฟล์)' : 'Supports PDF, images, Excel, Word (max 10 files / 25 MB each)' },
            ]
          },
          {
            heading: isTh ? 'Knowledge Base' : 'Knowledge Base',
            items: [
              { text: isTh ? 'เลือก Collection ใน Context Bar เหนือกล่องพิมพ์ เพื่อให้ AI อ้างอิงเอกสาร' : 'Select a Collection in the Context Bar above the input to let AI reference documents' },
              { text: isTh ? 'คลิก badge 📄 บนข้อความที่ AI ตอบ เพื่อดู Evidence ใน PDF ต้นฉบับ' : 'Click the 📄 badge on an AI message to view the evidence in the original PDF' },
            ]
          },
          {
            heading: isTh ? 'Sidebar ประวัติสนทนา' : 'Chat History Sidebar',
            items: [
              { text: isTh ? 'คลิก ☰ หรือ hover ขอบซ้ายเพื่อเปิด Sidebar' : 'Click ☰ or hover the left edge to open Sidebar' },
              { text: isTh ? 'คลิก + เพื่อเริ่มสนทนาใหม่' : 'Click + to start a new conversation' },
              { text: isTh ? 'Hover ที่รายการ แล้วคลิก 🗑️ เพื่อลบสนทนา' : 'Hover an item and click 🗑️ to delete a conversation' },
            ]
          }
        ]
      }
    }

    // ── Knowledge Base ──────────────────────────────────────────
    if (path.startsWith('/knowledge')) {
      return {
        title: isTh ? 'วิธีใช้ Knowledge Base' : 'How to use Knowledge Base',
        sections: [
          {
            heading: isTh ? 'การอัปโหลดเอกสาร' : 'Uploading Documents',
            items: [
              { text: isTh ? 'คลิก "+ อัปโหลดเอกสาร" แล้วเลือกหรือลากวางไฟล์' : 'Click "+ Upload Document" then select or drag & drop a file' },
              { text: isTh ? 'รองรับ PDF, DOCX, TXT, CSV, XLSX' : 'Supported formats: PDF, DOCX, TXT, CSV, XLSX' },
              { text: isTh ? 'ไฟล์จะถูก Index อัตโนมัติ รอสักครู่จนสถานะเป็น ✅ Ready' : 'Files are indexed automatically — wait until status shows ✅ Ready' },
              { text: isTh ? 'เอกสารบางรายการต้องรอ Admin อนุมัติก่อน' : 'Some documents require Admin approval before being available' },
            ]
          },
          {
            heading: isTh ? 'การสร้าง Collection' : 'Creating Collections',
            items: [
              { text: isTh ? 'ไปแท็บ "Collections" แล้วคลิก "+ สร้าง Collection"' : 'Go to the "Collections" tab then click "+ Create Collection"' },
              { text: isTh ? 'ตั้งชื่อและคำอธิบาย เช่น "รายวิชา CS101" หรือ "ระเบียบมหาวิทยาลัย"' : 'Give it a name and description, e.g. "Course CS101" or "University Regulations"' },
            ]
          },
          {
            heading: isTh ? 'สถานะเอกสาร' : 'Document Status',
            items: [
              { text: isTh ? '⏳ Processing — ระบบกำลัง Index' : '⏳ Processing — System is indexing' },
              { text: isTh ? '✅ Ready — พร้อมใช้งาน' : '✅ Ready — Available for use' },
              { text: isTh ? '🕐 Pending — รอ Admin อนุมัติ' : '🕐 Pending — Awaiting Admin approval' },
              { text: isTh ? '❌ Failed — เกิดข้อผิดพลาด ลองอัปโหลดใหม่' : '❌ Failed — Error occurred, try re-uploading' },
            ]
          }
        ]
      }
    }

    // ── Admin Dashboard ─────────────────────────────────────────
    if (path === '/dashboard') {
      return {
        title: isTh ? 'วิธีใช้ Dashboard' : 'How to use Dashboard',
        sections: [
          {
            heading: isTh ? 'การ์ดสรุปสถิติ' : 'Summary Cards',
            items: [
              { text: isTh ? 'Token ทั้งหมด — จำนวน Token ที่ถูกใช้ตลอดการใช้งาน' : 'Total Tokens — cumulative tokens consumed' },
              { text: isTh ? 'Token วันนี้ — Token ที่ใช้ในวันปัจจุบัน' : 'Tokens Today — tokens used today' },
              { text: isTh ? 'ผู้ใช้งานวันนี้ — จำนวน User ที่ active ในวันนี้' : 'Active Users Today — users active today' },
              { text: isTh ? 'Request ทั้งหมดวันนี้ — จำนวน request ที่เกิดขึ้น' : 'Total Requests Today — number of requests made' },
            ]
          },
          {
            heading: isTh ? 'การ Refresh ข้อมูล' : 'Refreshing Data',
            items: [
              { text: isTh ? 'คลิกปุ่ม 🔄 มุมขวาบนเพื่อโหลดข้อมูลล่าสุด' : 'Click 🔄 in the top right to reload the latest data' },
            ]
          }
        ]
      }
    }

    // ── Admin Users ─────────────────────────────────────────────
    if (path.startsWith('/dashboard/users')) {
      return {
        title: isTh ? 'การจัดการผู้ใช้' : 'User Management',
        sections: [
          {
            heading: isTh ? 'การค้นหาและกรอง' : 'Searching & Filtering',
            items: [
              { text: isTh ? 'คลิกปุ่ม Role (All / Superadmin / Admin / Teacher / Student) เพื่อกรอง' : 'Click a Role button (All / Superadmin / Admin / Teacher / Student) to filter' },
              { text: isTh ? 'คลิกแถวผู้ใช้เพื่อเปิดหน้าแก้ไขข้อมูล' : 'Click any user row to open the edit form' },
            ]
          },
          {
            heading: isTh ? 'บทบาทในระบบ' : 'System Roles',
            items: [
              { text: isTh ? 'superadmin — สิทธิ์สูงสุด จัดการได้ทุกอย่าง' : 'superadmin — Full access, manages everything' },
              { text: isTh ? 'admin — จัดการ User, ดู Dashboard, อนุมัติ Knowledge' : 'admin — Manage users, view dashboard, approve knowledge' },
              { text: isTh ? 'teacher — ใช้ AI Chat, จัดการ Knowledge Base ของตัวเอง' : 'teacher — Use AI Chat, manage own Knowledge Base' },
              { text: isTh ? 'student — ใช้ AI Chat, อัปโหลดเอกสาร (รอการอนุมัติ)' : 'student — Use AI Chat, upload documents (pending approval)' },
            ]
          }
        ]
      }
    }

    // ── Admin Prompts ───────────────────────────────────────────
    if (path.startsWith('/dashboard/prompts')) {
      return {
        title: isTh ? 'การจัดการ System Prompts' : 'System Prompts',
        sections: [
          {
            heading: isTh ? 'การแก้ไข Prompt' : 'Editing a Prompt',
            items: [
              { text: isTh ? 'เลือก Prompt จากรายการซ้าย (badge PROD คือ Production จริง)' : 'Select a prompt from the left list (PROD badge = live production)' },
              { text: isTh ? 'แก้ไขใน Editor ด้านขวา แล้วคลิก "Save Changes"' : 'Edit in the right editor then click "Save Changes"' },
              { text: isTh ? 'คลิก "Reset" เพื่อยกเลิกการเปลี่ยนแปลงที่ยังไม่ได้บันทึก' : 'Click "Reset" to discard unsaved changes' },
            ]
          },
          {
            heading: isTh ? '⚠️ ข้อควรระวัง' : '⚠️ Caution',
            items: [
              { text: isTh ? 'Prompt ที่มี badge PROD ส่งผลต่อการตอบของ AI ในระบบ Production ทันที — ควรทดสอบใน TEST ก่อนเสมอ' : 'PROD prompts affect live AI responses immediately — always test in TEST first' },
            ]
          }
        ]
      }
    }

    // ── Admin API Keys ──────────────────────────────────────────
    if (path.startsWith('/dashboard/api-keys')) {
      return {
        title: isTh ? 'การจัดการ API Keys' : 'API Keys',
        sections: [
          {
            heading: isTh ? 'การสร้าง Key ใหม่' : 'Creating a New Key',
            items: [
              { text: isTh ? 'คลิก "+ Create API Key" — Key จะแสดงครั้งเดียวเท่านั้น ต้องบันทึกทันที' : 'Click "+ Create API Key" — the key is shown only once, save it immediately' },
            ]
          },
          {
            heading: isTh ? 'การยกเลิก Key' : 'Revoking a Key',
            items: [
              { text: isTh ? 'คลิก "Revoke" ที่แถว Key ที่ต้องการยกเลิก — ไม่สามารถกู้คืนได้' : 'Click "Revoke" on the key row — this action cannot be undone' },
            ]
          }
        ]
      }
    }

    // ── Admin Tools ─────────────────────────────────────────────
    if (path.startsWith('/dashboard/tools')) {
      return {
        title: isTh ? 'การจัดการ Tool Access' : 'Tool Access',
        sections: [
          {
            heading: isTh ? 'เกี่ยวกับ Topic นี้' : 'About Tool Access',
            items: [
              { text: isTh ? 'ใช้ควบคุมว่า User กลุ่มใดเข้าถึงเครื่องมือพิเศษของ AI ได้บ้าง เช่น Web Search, Calculator' : 'Controls which user groups can access special AI tools such as Web Search, Calculator' },
              { text: isTh ? 'เปิด/ปิด Toggle เพื่อให้หรือเพิกถอนสิทธิ์การใช้งานเครื่องมือ' : 'Toggle switches to grant or revoke tool access per role or user' },
            ]
          }
        ]
      }
    }

    // ── Admin Departments ───────────────────────────────────────
    if (path.startsWith('/dashboard/departments')) {
      return {
        title: isTh ? 'การจัดการหน่วยงาน' : 'Department Management',
        sections: [
          {
            heading: isTh ? 'การเพิ่ม / แก้ไข / ลบ' : 'Add / Edit / Delete',
            items: [
              { text: isTh ? 'คลิก "+ Add Department" เพื่อเพิ่มหน่วยงานใหม่' : 'Click "+ Add Department" to add a new department' },
              { text: isTh ? 'คลิกปุ่มแก้ไขในแถวหน่วยงานเพื่อเปลี่ยนชื่อ' : 'Click the edit button on a row to rename a department' },
              { text: isTh ? 'คลิกปุ่มลบและยืนยัน — ข้อมูลจะถูกลบถาวร' : 'Click delete and confirm — data will be permanently removed' },
            ]
          }
        ]
      }
    }

    // ── Fallback / Generic ──────────────────────────────────────
    return {
      title: isTh ? 'ภาพรวมระบบ MFULearnAI' : 'MFULearnAI Overview',
      sections: [
        {
          heading: isTh ? 'เมนูหลัก' : 'Main Navigation',
          items: [
            { text: isTh ? 'AI Chat — สนทนากับ AI สรุป เขียน วิเคราะห์' : 'AI Chat — converse with AI to summarize, write, or analyze' },
            { text: isTh ? 'Knowledge Base — อัปโหลดเอกสารให้ AI อ้างอิง' : 'Knowledge Base — upload documents for AI to reference' },
            { text: isTh ? 'Admin Panel — จัดการผู้ใช้ สถิติ และการตั้งค่าระบบ (เฉพาะ Admin)' : 'Admin Panel — manage users, stats, and settings (Admin only)' },
          ]
        },
        {
          heading: isTh ? 'การตั้งค่า' : 'Settings',
          items: [
            { text: isTh ? 'คลิกอวาตาร์มุมขวาบน หรือ ☰ บน Sidebar เพื่อเปิดเมนูตั้งค่า' : 'Click the avatar top-right or the ☰ in Sidebar to open the settings menu' },
            { text: isTh ? 'สลับธีม Dark / Light และภาษา ไทย / อังกฤษ ได้ใน Settings Menu' : 'Toggle Dark/Light theme and TH/EN language in the Settings menu' },
          ]
        }
      ]
    }
  })

  return { helpContent: content }
}
