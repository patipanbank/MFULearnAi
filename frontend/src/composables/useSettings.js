import { ref, watch } from 'vue'

const THEME_KEY = 'mful_theme'
const LANG_KEY = 'mful_lang'

export function useTheme() {
    const isDark = ref(true)

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
    const lang = ref('th') // 'th' or 'en'

    const translations = {
        th: {
            newChat: 'แชทใหม่',
            recentChats: 'แชทล่าสุด',
            noChats: 'ยังไม่มีแชท',
            logout: 'ออกจากระบบ',
            settings: 'ตั้งค่า',
            typeMessage: 'พิมพ์ข้อความ...',
            disclaimer: 'AI อาจให้ข้อมูลที่ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลสำคัญ',
            welcome: 'สวัสดี',
            welcomeSub: 'ฉันพร้อมช่วยเหลือคุณ',
            thinking: 'กำลังคิด...',
            uploadFile: 'อัพโหลดไฟล์',
            copy: 'คัดลอก',
            copied: 'คัดลอกแล้ว'
        },
        en: {
            newChat: 'New Chat',
            recentChats: 'Recent Chats',
            noChats: 'No chats yet',
            logout: 'Logout',
            settings: 'Settings',
            typeMessage: 'Type a message...',
            disclaimer: 'AI may produce inaccurate information. Please verify important details.',
            welcome: 'Hello',
            welcomeSub: "I'm here to help you",
            thinking: 'Thinking...',
            uploadFile: 'Upload File',
            copy: 'Copy',
            copied: 'Copied'
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
