import { ref, watch } from 'vue'

const THEME_KEY = 'mful_theme'
const LANG_KEY = 'mful_lang'

// Global State (Singleton)
const isDark = ref(true)
const lang = ref('th')

export function useTheme() {
    // Initialize from localStorage or system preference
    const init = () => {
        const saved = localStorage.getItem(THEME_KEY)
        if (saved) {
            isDark.value = saved === 'dark'
        } else {
            // Check system preference
            isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
        }
        applyTheme()
    }

    const applyTheme = () => {
        document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
        localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
    }

    const toggle = () => {
        isDark.value = !isDark.value
        applyTheme()
    }

    watch(isDark, applyTheme)

    return { isDark, toggle, init }
}

export function useLanguage() {
    const translations = {
        th: {
            // Chat
            newChat: 'แชทใหม่',
            recentChats: 'แชทล่าสุด',
            noChats: 'ยังไม่มีแชท',
            typeMessage: 'พิมพ์ข้อความ...',
            disclaimer: 'AI อาจให้ข้อมูลที่ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลสำคัญ',
            welcome: 'สวัสดี',
            welcomeSub: 'ฉันพร้อมช่วยเหลือคุณ',
            thinking: 'กำลังคิด...',
            uploadFile: 'อัพโหลดไฟล์',
            copy: 'คัดลอก',
            copied: 'คัดลอกแล้ว',
            activeKnowledge: 'แหล่งความรู้ที่ใช้งาน:',
            defaultCollection: 'คอลเลกชันมาตรฐาน (จัดการโดยแอดมิน)',
            newConversation: 'บทสนทนาใหม่',

            // Navigation & Menu
            menu: 'เมนู',
            settings: 'ตั้งค่า',
            logout: 'ออกจากระบบ',
            chat: 'AI แชท',
            knowledge: 'คลังความรู้',
            admin: 'ผู้ดูแลระบบ',
            apps: 'แอปพลิเคชัน',
            preferences: 'การตั้งค่า',
            theme: 'ธีม',
            language: 'ภาษา',
            light: 'สว่าง',
            dark: 'มืด',

            // Knowledge Dashboard
            knowledgeTitle: 'คลังความรู้',
            knowledgeSubtitle: 'จัดการแหล่งข้อมูลและคอลเลกชัน',
            knowledgePlaceholder: 'เลือกคอลเลกชันหรือเอกสารเพื่อดูรายละเอียด',

            // Admin Dashboard
            adminTitle: 'แดชบอร์ดผู้ดูแลระบบ',
            adminSubtitle: 'ตั้งค่าระบบและจัดการผู้ใช้',
            adminPlaceholder: 'กำหนดค่าระบบและจัดการการเข้าถึง',

            // Login & Auth
            appSubtitle: 'ผู้ช่วย AI ขับเคลื่อนโดย MFU',
            stagingEnv: 'สภาพแวดล้อมทดสอบ',
            loginMFU: 'เข้าสู่ระบบด้วยบัญชี MFU',
            loginGoogle: 'เข้าสู่ระบบด้วย Google',
            agreeTo: 'เมื่อเข้าสู่ระบบ คุณยอมรับ',
            terms: 'ข้อกำหนดการใช้งาน',
            and: 'และ',
            pdpa: 'นโยบาย PDPA',
            authenticating: 'กำลังยืนยันตัวตน...',
            verifyCreds: 'กรุณารอซักครู่ ระบบกำลังตรวจสอบข้อมูลของคุณ',
            aiAssistant: 'ผู้ช่วย AI',
            guest: 'ผู้เยี่ยมชม',
            appName: 'MFU Learn'
        },
        en: {
            // Chat
            newChat: 'New Chat',
            recentChats: 'Recent Chats',
            noChats: 'No chats yet',
            typeMessage: 'Ask anything...',
            disclaimer: 'AI may produce inaccurate information. Please verify important details.',
            welcome: 'Hello',
            welcomeSub: "I'm here to help you",
            thinking: 'Thinking...',
            uploadFile: 'Upload File',
            copy: 'Copy',
            copied: 'Copied',
            activeKnowledge: 'Active Knowledge:',
            defaultCollection: 'Default Collection (Admin Managed)',
            newConversation: 'New Conversation',

            // Navigation & Menu
            menu: 'Menu',
            settings: 'Settings',
            logout: 'Logout',
            chat: 'AI Chat',
            knowledge: 'Knowledge Base',
            admin: 'Admin Console',
            apps: 'Applications',
            preferences: 'Preferences',
            theme: 'Theme',
            language: 'Language',
            light: 'Light',
            dark: 'Dark',

            // Knowledge Dashboard
            knowledgeTitle: 'Knowledge Base',
            knowledgeSubtitle: 'Manage your AI sources and collections',
            knowledgePlaceholder: 'Select a collection or document to view details',

            // Admin Dashboard
            adminTitle: 'Admin Dashboard',
            adminSubtitle: 'System settings and user management',
            adminPlaceholder: 'Configure system preferences and manage access',

            // Login & Auth
            appSubtitle: 'AI Assistant powered by MFU',
            stagingEnv: 'Staging Environment',
            loginMFU: 'Login with MFU Account',
            loginGoogle: 'Login with Google',
            agreeTo: 'By logging in, you agree to our',
            terms: 'Terms of Service',
            and: 'and',
            pdpa: 'PDPA Policy',
            authenticating: 'Authenticating...',
            verifyCreds: 'Please wait while we verify your credentials',
            aiAssistant: 'AI Assistant',
            guest: 'Guest',
            appName: 'MFU Learn'
        }
    }

    const init = () => {
        const saved = localStorage.getItem(LANG_KEY)
        if (saved) {
            lang.value = saved
        } else {
            // Auto-detect from browser
            const browserLang = navigator.language.toLowerCase()
            lang.value = browserLang.startsWith('th') ? 'th' : 'en'
        }
    }

    const toggle = () => {
        lang.value = lang.value === 'th' ? 'en' : 'th'
        localStorage.setItem(LANG_KEY, lang.value)
    }

    const t = (key) => {
        return translations[lang.value]?.[key] || translations.en[key] || key
    }

    return { lang, toggle, t, init }
}
