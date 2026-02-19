import { ref, watch } from 'vue'

// ─── Storage Keys ───────────────────────────────────────────────
const THEME_KEY = 'mful_theme'
const LANG_KEY = 'mful_lang'

// ─── Global Singleton State ─────────────────────────────────────
const savedTheme = localStorage.getItem(THEME_KEY)
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const initialDark = savedTheme ? savedTheme === 'dark' : systemDark

const isDark = ref(initialDark)

// Initialize language from localStorage or browser preference
const savedLang = localStorage.getItem(LANG_KEY)
const browserLang = navigator.language.toLowerCase()
const initialLang = savedLang || (browserLang.startsWith('th') ? 'th' : 'en')
const lang = ref(initialLang)

// Guard to ensure theme watcher is registered exactly once
let themeWatcherRegistered = false

// ─── Translations (module-level constant to avoid re-creation) ──
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
        deleteChat: 'ลบแชท',
        confirmDeleteChat: 'คุณแน่ใจว่าต้องการลบแชทนี้หรือไม่?',

        // Navigation & Menu
        menu: 'เมนู',
        settings: 'ตั้งค่า',
        logout: 'ออกจากระบบ',
        confirmLogoutTitle: 'ยืนยันการออกจากระบบ',
        confirmLogoutMessage: 'คุณแน่ใจว่าต้องการออกจากระบบหรือไม่?',
        confirm: 'ยืนยัน',
        cancel: 'ยกเลิก',
        aiChat: 'AI แชท',
        knowledgeBase: 'คลังความรู้',
        admin: 'ผู้ดูแลระบบ',
        apps: 'แอปพลิเคชัน',
        preferences: 'การตั้งค่า',
        theme: 'ธีม',
        language: 'ภาษา',
        light: 'สว่าง',
        dark: 'มืด',

        // Admin Navigation
        adminTools: 'เครื่องมือแอดมิน',
        dashboard: 'แดชบอร์ด',
        usersAndAdmins: 'ผู้ใช้และแอดมิน',
        departments: 'สำนัก/ส่วน',
        systemPrompts: 'พรอมต์ระบบ',

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
        collections: 'คอลเลกชัน',
        newCollection: 'สร้างคอลเลกชัน',
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
        deleteChat: 'Delete Chat',
        confirmDeleteChat: 'Are you sure you want to delete this chat?',

        // Navigation & Menu
        menu: 'Menu',
        settings: 'Settings',
        logout: 'Logout',
        confirmLogoutTitle: 'Confirm Logout',
        confirmLogoutMessage: 'Are you sure you want to log out?',
        confirm: 'Confirm',
        cancel: 'Cancel',
        aiChat: 'AI Chat',
        knowledgeBase: 'Knowledge Base',
        admin: 'Admin Console',
        apps: 'Applications',
        preferences: 'Preferences',
        theme: 'Theme',
        language: 'Language',
        light: 'Light',
        dark: 'Dark',

        // Admin Navigation
        adminTools: 'Admin Tools',
        dashboard: 'Dashboard',
        usersAndAdmins: 'Users & Admins',
        departments: 'Departments',
        systemPrompts: 'System Prompts',

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
        collections: 'Collections',
        newCollection: 'New Collection',
    }
}

// ─── Theme Composable ───────────────────────────────────────────
export function useTheme() {
    const applyTheme = () => {
        document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
        localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
    }

    const init = () => {
        applyTheme()
    }

    const toggle = () => {
        isDark.value = !isDark.value
        applyTheme()
    }

    // Register global watcher exactly once to avoid memory leaks
    if (!themeWatcherRegistered) {
        watch(isDark, applyTheme)
        themeWatcherRegistered = true
    }

    return { isDark, toggle, init }
}

// ─── Language Composable ────────────────────────────────────────
export function useLanguage() {
    const init = () => {
        const saved = localStorage.getItem(LANG_KEY)
        if (saved) {
            lang.value = saved
        } else {
            const detectedLang = navigator.language.toLowerCase()
            lang.value = detectedLang.startsWith('th') ? 'th' : 'en'
        }
    }

    const toggle = () => {
        lang.value = lang.value === 'th' ? 'en' : 'th'
        localStorage.setItem(LANG_KEY, lang.value)
    }

    /** @param {string} key - Translation key */
    const t = (key) => {
        return translations[lang.value]?.[key] || translations.en[key] || key
    }

    return { lang, toggle, t, init }
}
