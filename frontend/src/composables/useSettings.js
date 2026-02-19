import { ref, watch } from 'vue'

const THEME_KEY = 'mful_theme'
const LANG_KEY = 'mful_lang'

// Global State (Singleton)
const savedTheme = localStorage.getItem(THEME_KEY)
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const initialDark = savedTheme ? savedTheme === 'dark' : systemDark

const isDark = ref(initialDark)
const lang = ref('th')

export function useTheme() {
    const applyTheme = () => {
        document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
        localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
    }

    // Initialize from localStorage or system preference
    const init = () => {
        // Re-apply in case DOM wasn't ready during initial load, 
        // or if we want to ensure sync.
        applyTheme()
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
            welcomeSub: 'วันนี้ให้ฉันช่วยอะไรคุณดี?',
            thinking: 'กำลังคิด...',
            uploadFile: 'อัพโหลดไฟล์',
            copy: 'คัดลอก',
            copied: 'คัดลอกแล้ว',
            activeKnowledge: 'แหล่งความรู้ที่ใช้งาน:',
            selectContext: 'เลือกบริบท',
            defaultCollection: 'คอลเลกชันมาตรฐาน (จัดการโดยแอดมิน)',
            newConversation: 'บทสนทนาใหม่',

            // Navigation & Menu
            menu: 'เมนู',
            settings: 'ตั้งค่า',
            settings: 'ตั้งค่า',
            logout: 'ออกจากระบบ',
            confirmLogoutTitle: 'ยืนยันการออกจากระบบ',
            confirmLogoutMessage: 'คุณแน่ใจว่าต้องการออกจากระบบหรือไม่?',
            confirm: 'ยืนยัน',
            cancel: 'ยกเลิก',
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
            adminSubtitle: 'สถิติการใช้งานระบบและตัวชี้วัดประสิทธิภาพ',
            adminPlaceholder: 'กำหนดค่าระบบและจัดการการเข้าถึง',
            totalTokensAllTime: 'โทเค็นทั้งหมด (ตลอดกาล)',
            tokensToday: 'โทเค็น (วันนี้)',
            activeUsersToday: 'ผู้ใช้งาน (วันนี้)',
            totalRequestsToday: 'คำขอทั้งหมด (วันนี้)',
            usageTrend: 'แนวโน้มการใช้งาน (7 วันล่าสุด)',
            modelDistribution: 'สัดส่วนโมเดล',
            tokensUsed: 'โทเค็นที่ใช้',
            requests: 'คำขอ',
            refresh: 'รีเฟรช',
            loadingData: 'กำลังโหลดข้อมูล...',
            errorLoadingData: 'ไม่สามารถโหลดข้อมูลได้',
            retry: 'ลองอีกครั้ง',
            noUsageData: 'ไม่มีข้อมูลการใช้งาน',
            manageRequests: 'จัดการคำขอ',

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
            aiAssistant: 'DinDin AI',
            guest: 'ผู้เยี่ยมชม',
            appName: 'DinDin AI',
            knowledgeBase: 'ฐานความรู้',
            collections: 'คอลเลกชัน',
            newCollection: 'สร้างคอลเลกชัน',
            uploadFile: 'อัพโหลดไฟล์'
        },
        en: {
            // Chat
            newChat: 'New Chat',
            recentChats: 'Recent Chats',
            noChats: 'No chats yet',
            typeMessage: 'Ask anything...',
            disclaimer: 'AI may produce inaccurate information. Please verify important details.',
            welcome: 'Welcome',
            welcomeSub: 'How can I help you today?',
            thinking: 'Thinking...',
            uploadFile: 'Upload File',
            copy: 'Copy',
            copied: 'Copied',
            activeKnowledge: 'Active Knowledge:',
            selectContext: 'Select Context',
            defaultCollection: 'Default Collection (Admin Managed)',
            newConversation: 'New Conversation',

            // Navigation & Menu
            menu: 'Menu',
            settings: 'Settings',
            settings: 'Settings',
            logout: 'Logout',
            confirmLogoutTitle: 'Confirm Logout',
            confirmLogoutMessage: 'Are you sure you want to log out?',
            confirm: 'Confirm',
            cancel: 'Cancel',
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
            adminSubtitle: 'System usage statistics and performance metrics',
            adminPlaceholder: 'Configure system preferences and manage access',
            totalTokensAllTime: 'Total Tokens (All Time)',
            tokensToday: 'Tokens (Today)',
            activeUsersToday: 'Active Users (Today)',
            totalRequestsToday: 'Total Requests (Today)',
            usageTrend: 'Usage Trend (Last 7 Days)',
            modelDistribution: 'Model Distribution',
            tokensUsed: 'Tokens Used',
            requests: 'Requests',
            refresh: 'Refresh',
            loadingData: 'Loading data...',
            errorLoadingData: 'Failed to load data',
            retry: 'Retry',
            noUsageData: 'No usage data',
            manageRequests: 'Manage Requests',

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
            aiAssistant: 'DinDin AI',
            guest: 'Guest',
            appName: 'DinDin AI',
            knowledgeBase: 'Knowledge Base',
            collections: 'Collections',
            newCollection: 'New Collection',
            uploadFile: 'Upload File'
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
