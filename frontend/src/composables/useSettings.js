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

        // Tools
        'tool.search': 'ค้นหาข้อมูล',
        'tool.checkPolicy': 'ตรวจสอบระเบียบ',
        'tool.calculator': 'คำนวณ',
        'tool.mcp': 'เครื่องมือ MCP',
        'tool.using': 'กำลังใช้',
        'tool.done': 'เสร็จสิ้น',
        'tool.failed': 'ล้มเหลว',

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
        apiKeys: 'คีย์ API',
        toolAccess: 'จัดการ Tools',

        // Department Management
        deptPageTitle: 'จัดการสำนัก/ส่วน',
        deptPageSubtitle: 'จัดการหน่วยงานมหาวิทยาลัย สร้างอัตโนมัติจากการเข้าสู่ระบบ SSO',
        deptCreate: 'สร้างหน่วยงาน',
        deptEdit: 'แก้ไขหน่วยงาน',
        deptDelete: 'ลบ',
        deptName: 'ชื่อ',
        deptCode: 'รหัส',
        deptCreatedAt: 'สร้างเมื่อ',
        deptActions: 'การกระทำ',
        deptNameLabel: 'ชื่อหน่วยงาน',
        deptNamePlaceholder: 'เช่น สำนักวิชาเทคโนโลยีสารสนเทศ',
        deptSave: 'บันทึก',
        deptSaving: 'กำลังบันทึก...',
        deptClose: 'ปิด',
        deptEmpty: 'ยังไม่มีหน่วยงาน',
        deptFetchError: 'ไม่สามารถโหลดรายการหน่วยงานได้',
        deptOperationFailed: 'การดำเนินการล้มเหลว',
        deptDeleteConfirmTitle: 'ยืนยันการลบ',
        deptDeleteConfirmMessage: 'คุณแน่ใจว่าต้องการลบหน่วยงาน "{name}" หรือไม่? ผู้ใช้ที่ผูกกับหน่วยงานนี้จะสูญเสียการเชื่อมโยง',
        deptDeleteConfirm: 'ลบหน่วยงาน',
        deptDeleting: 'กำลังลบ...',
        deptDeleteFailed: 'ไม่สามารถลบหน่วยงานได้',
        deptEditAria: 'แก้ไขหน่วยงาน: ',
        deptDeleteAria: 'ลบหน่วยงาน: ',
        deptNameTooShort: 'ชื่อหน่วยงานต้องมีอย่างน้อย 2 ตัวอักษร',
        deptNameTooLong: 'ชื่อหน่วยงานต้องไม่เกิน 100 ตัวอักษร',

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
        pendingRequests: 'คำขอที่รอดำเนินการ',

        // Admin Requests Modal
        managePublishRequests: 'จัดการคำขอเผยแพร่',
        refreshList: 'รีเฟรช',
        loadingRequests: 'กำลังโหลดคำขอ...',
        noPendingRequests: 'ไม่มีคำขอที่รอดำเนินการ',
        noPendingRequestsDesc: 'คำขอเผยแพร่ใหม่จะปรากฏที่นี่',
        requestOwner: 'เจ้าของ',
        requestDept: 'หน่วยงาน',
        requestTarget: 'เป้าหมาย',
        approveRequest: 'อนุมัติ',
        rejectRequest: 'ปฏิเสธ',
        confirmApprove: 'คุณแน่ใจว่าต้องการอนุมัติคำขอนี้หรือไม่?',
        confirmReject: 'คุณแน่ใจว่าต้องการปฏิเสธคำขอนี้หรือไม่?',
        approving: 'กำลังอนุมัติ...',
        rejecting: 'กำลังปฏิเสธ...',

        // Knowledge Detail Modal
        knowledgeDetails: 'รายละเอียดความรู้',
        knowledgeDetailTitle: 'ชื่อ',
        knowledgeDetailType: 'ประเภท',
        knowledgeDetailDept: 'หน่วยงาน',
        knowledgeDetailDesc: 'คำอธิบาย',
        knowledgeDetailNoDesc: 'ไม่มีคำอธิบาย',
        knowledgeDetailSource: 'แหล่งที่มา',
        knowledgeDetailCreated: 'สร้างเมื่อ',
        knowledgeDetailContent: 'ตัวอย่างเนื้อหา',
        knowledgeDetailExpand: 'ขยาย',
        knowledgeDetailNoContent: 'ไม่มีเนื้อหา',
        knowledgeDetailNoContentDesc: 'ไฟล์ที่อัพโหลดก่อนอัปเดตล่าสุดไม่มีเนื้อหาที่อ่านได้',
        publishStatus: 'สถานะการเผยแพร่',
        publishStatusLabel: 'สถานะ',
        publishTargetLabel: 'เป้าหมาย',
        requestPublishToDept: 'ขอเผยแพร่ไปยังหน่วยงาน',
        requestPublishAction: 'ขอเผยแพร่',
        confirmPublishToDept: 'คุณต้องการขอเผยแพร่รายการนี้ไปยัง department หรือไม่?',
        pendingApproval: 'คำขอเผยแพร่ของคุณกำลังรอการอนุมัติ',
        knowledgeActions: 'การดำเนินการ',

        // Knowledge List
        searchKnowledge: 'ค้นหาตามชื่อ, แท็ก, หรือคำอธิบาย...',
        filterAll: 'ทั้งหมด',
        filterPersonal: 'ส่วนตัว',
        filterDepartment: 'หน่วยงาน',
        filterPublic: 'สาธารณะ',
        filterPolicy: 'นโยบาย',
        colName: 'ชื่อ',
        colType: 'ประเภท',
        colDepartment: 'หน่วยงาน',
        colStatus: 'สถานะ',
        colActions: 'การดำเนินการ',
        publishBtn: 'ขอเผยแพร่',
        directPublishBtn: 'เผยแพร่',
        toDepartment: 'ไปยังหน่วยงาน',
        toPublic: 'สาธารณะ',
        toPublicAdminOnly: 'สาธารณะ (เฉพาะ Admin)',
        confirmDeleteKnowledge: 'คุณแน่ใจว่าต้องการลบรายการนี้หรือไม่?',
        confirmPublishRequest: 'ต้องการขอเผยแพร่เป็น {type} หรือไม่?',
        confirmDirectPublish: 'ต้องการเผยแพร่เป็น {type} หรือไม่?',
        publishRequestTitle: 'คำขอเผยแพร่',
        retryProcessing: 'ลองประมวลผลใหม่',
        publishSuccess: 'เผยแพร่สำเร็จแล้ว',
        publishRequestSent: 'ส่งคำขอเผยแพร่แล้ว รอการอนุมัติจาก Admin',
        publishFailed: 'ไม่สามารถเผยแพร่ได้',
        processingStatus: 'กำลังประมวลผล...',
        noKnowledgeFound: 'ไม่พบข้อมูลความรู้',

        // Collection Modals
        editCollection: 'แก้ไขคอลเลกชัน',
        newCollectionTitle: 'สร้างคอลเลกชันใหม่',
        collectionName: 'ชื่อ',
        collectionNamePlaceholder: 'ชื่อคอลเลกชัน',
        collectionDescLabel: 'คำอธิบาย (ไม่บังคับ)',
        collectionDescPlaceholder: 'คอลเลกชันนี้ใช้สำหรับอะไร?',
        confirmDeleteCollection: 'คุณแน่ใจว่าต้องการลบคอลเลกชันนี้หรือไม่? การลบไม่สามารถย้อนกลับได้',
        deleteBtn: 'ลบ',
        savingBtn: 'กำลังบันทึก...',
        updateBtn: 'อัปเดต',
        createBtn: 'สร้าง',
        collectionContents: 'เนื้อหา',
        doneBtn: 'เสร็จสิ้น',
        addContentBtn: '+ เพิ่มเนื้อหา',
        addBtn: 'เพิ่ม',
        emptyCollection: 'คอลเลกชันนี้ว่างเปล่า',
        searchKnowledgeToAdd: 'ค้นหาความรู้เพื่อเพิ่ม...',
        noMatchingKnowledge: 'ไม่พบความรู้ที่ตรงกัน',
        confirmRemoveFromCollection: 'ต้องการนำรายการนี้ออกจากคอลเลกชันหรือไม่?',
        collectionNoDesc: 'ไม่มีคำอธิบาย',
        collectionItemCount: 'รายการ',
        collectionNameRequired: 'กรุณากรอกชื่อคอลเลกชัน',
        collectionNameMinLength: 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร',
        deletingBtn: 'กำลังลบ...',
        removeFromCollectionBtn: 'นำออกจากคอลเลกชัน',
        emptyCollectionHint: 'กดปุ่ม "+ เพิ่มเนื้อหา" เพื่อเพิ่มความรู้ลงในคอลเลกชัน',
        noCollectionsFound: 'ไม่พบคอลเลกชัน',
        noCollectionsHint: 'สร้างคอลเลกชันเพื่อจัดระเบียบความรู้ของคุณ',
        openBtn: 'เปิด',

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

        // Upload Knowledge
        uploadTitle: 'อัปโหลดความรู้',
        fileUploadMode: '📄 อัปโหลดไฟล์',
        rawTextMode: '📝 ข้อความล้วน',
        fromUrlMode: '🔗 จากลิงก์ (URL)',
        selectFilesLimit: 'เลือกไฟล์ (PDF, Office, Text, Code, Images) — สูงสุด',
        dropFilesHint: 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์',
        websiteUrlLabel: 'ลิงก์เว็บไซต์',
        urlInputPlaceholder: 'https://example.com/page',
        urlExtractionHint: 'เนื้อหาของหน้าเว็บจะถูกดึงมาบันทึกไว้ในฐานความรู้',
        docTitleLabel: 'หัวข้อเอกสาร',
        docTitlePlaceholder: 'เช่น โน้ตการประชุมสำคัญ',
        textContentLabel: 'เนื้อหาข้อความ',
        textInputPlaceholder: 'วางข้อความหรือโน้ตของคุณที่นี่...',
        textConversionHint: 'ข้อความนี้จะถูกแปลงเป็นเอกสารที่สามารถค้นหาด้วย AI ได้',
        visibilityLabel: 'สิทธิ์การมองเห็น',
        visPersonalOpt: 'ส่วนตัว (Private)',
        visDeptOpt: 'แผนก (Department)',
        visPublicOpt: 'สาธารณะ (ทั้งหมด)',
        visPolicyOpt: 'นโยบายควบคุม (System Policy)',
        hintVisPersonal: 'มองเห็นได้เฉพาะคุณคนเดียวเท่านั้น',
        hintVisDept: 'มองเห็นได้ทุกคนในแผนก',
        hintVisPublic: 'มองเห็นได้ทุกคนในมหาวิทยาลัย',
        hintVisPolicy: 'บังคับใช้เป็นบริบททั่วทั้งระบบ (เฉพาะ Admin)',
        folderPathLabel: 'โฟลเดอร์จำลอง (ไม่บังคับ)',
        folderPathPlaceholder: 'เช่น HR/Policies/2023',
        folderPathHint: 'จัดหมวดหมู่เอกสารให้เป็นระเบียบ',
        expiryDateLabel: 'วันหมดอายุ / วันที่ต้องอัปเดต (ไม่บังคับ)',
        expiryDateHint: 'ใช้เป็นกำหนดการแจ้งเตือนให้กลับมาตรวจสอบ',
        uploadingStatus: 'กำลังอัปโหลด',
        scrapingStatus: 'กำลังดึงข้อมูลหน้าเว็บ...',
        pastingStatus: 'กำลังบันทึกข้อความลงฐานข้อมูล...',
        cancelBtn: 'ยกเลิก',
        processingBtn: 'กำลังดำเนินการ...',
        importBtn: 'นำเข้าข้อมูล',
        uploadBtnText: 'อัปโหลด',
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

        // Tools
        'tool.search': 'Searching',
        'tool.checkPolicy': 'Checking Policy',
        'tool.calculator': 'Calculating',
        'tool.mcp': 'MCP Tool',
        'tool.using': 'Using',
        'tool.done': 'Done',
        'tool.failed': 'Failed',

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
        apiKeys: 'API Keys',
        toolAccess: 'Tool Access',

        // Department Management
        deptPageTitle: 'Departments',
        deptPageSubtitle: 'Manage university departments. Auto-created from SSO logins.',
        deptCreate: 'Create Department',
        deptEdit: 'Edit Department',
        deptDelete: 'Delete',
        deptName: 'Name',
        deptCode: 'Code',
        deptCreatedAt: 'Created At',
        deptActions: 'Actions',
        deptNameLabel: 'Department Name',
        deptNamePlaceholder: 'e.g. School of IT',
        deptSave: 'Save',
        deptSaving: 'Saving...',
        deptClose: 'Close',
        deptEmpty: 'No departments found.',
        deptFetchError: 'Failed to load departments',
        deptOperationFailed: 'Operation failed',
        deptDeleteConfirmTitle: 'Confirm Delete',
        deptDeleteConfirmMessage: 'Are you sure you want to delete "{name}"? Users assigned to it might lose their mapping.',
        deptDeleteConfirm: 'Delete Department',
        deptDeleting: 'Deleting...',
        deptDeleteFailed: 'Failed to delete department',
        deptEditAria: 'Edit department: ',
        deptDeleteAria: 'Delete department: ',
        deptNameTooShort: 'Department name must be at least 2 characters',
        deptNameTooLong: 'Department name must not exceed 100 characters',

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
        pendingRequests: 'Pending Requests',

        // Admin Requests Modal
        managePublishRequests: 'Manage Publish Requests',
        refreshList: 'Refresh',
        loadingRequests: 'Loading requests...',
        noPendingRequests: 'No pending requests',
        noPendingRequestsDesc: 'New publish requests will appear here',
        requestOwner: 'Owner',
        requestDept: 'Dept',
        requestTarget: 'Target',
        approveRequest: 'Approve',
        rejectRequest: 'Reject',
        confirmApprove: 'Are you sure you want to approve this request?',
        confirmReject: 'Are you sure you want to reject this request?',
        approving: 'Approving...',
        rejecting: 'Rejecting...',

        // Knowledge Detail Modal
        knowledgeDetails: 'Knowledge Details',
        knowledgeDetailTitle: 'Title',
        knowledgeDetailType: 'Type',
        knowledgeDetailDept: 'Department',
        knowledgeDetailDesc: 'Description',
        knowledgeDetailNoDesc: 'No description provided.',
        knowledgeDetailSource: 'File Source',
        knowledgeDetailCreated: 'Created At',
        knowledgeDetailContent: 'Content Preview',
        knowledgeDetailExpand: 'Expand',
        knowledgeDetailNoContent: 'No content available.',
        knowledgeDetailNoContentDesc: 'Files uploaded before the latest update do not have readable content stored.',
        publishStatus: 'Publish Status',
        publishStatusLabel: 'Status',
        publishTargetLabel: 'Target',
        requestPublishToDept: 'Request Publish to Department',
        requestPublishAction: 'Request Publish',
        confirmPublishToDept: 'Request to publish this item to department?',
        pendingApproval: 'Your request to publish is pending approval.',
        knowledgeActions: 'Actions',

        // Knowledge List
        searchKnowledge: 'Search by name, tag, or description...',
        filterAll: 'All',
        filterPersonal: 'Personal',
        filterDepartment: 'Department',
        filterPublic: 'Public',
        filterPolicy: 'Policy',
        colName: 'Name',
        colType: 'Type',
        colDepartment: 'Department',
        colStatus: 'Status',
        colActions: 'Actions',
        publishBtn: 'Request Publish',
        directPublishBtn: 'Publish',
        toDepartment: 'To Department',
        toPublic: 'To Public',
        toPublicAdminOnly: 'To Public (Admin Only)',
        confirmDeleteKnowledge: 'Are you sure you want to delete this item?',
        confirmPublishRequest: 'Request to publish this as {type}?',
        confirmDirectPublish: 'Publish this as {type}?',
        publishRequestTitle: 'Publish Request',
        retryProcessing: 'Retry Processing',
        publishSuccess: 'Published successfully',
        publishRequestSent: 'Publish request sent. Awaiting admin approval.',
        publishFailed: 'Publish failed',
        processingStatus: 'Processing...',
        noKnowledgeFound: 'No knowledge found.',

        // Collection Modals
        editCollection: 'Edit Collection',
        newCollectionTitle: 'New Collection',
        collectionName: 'Name',
        collectionNamePlaceholder: 'Collection Name',
        collectionDescLabel: 'Description (Optional)',
        collectionDescPlaceholder: 'What is this collection for?',
        confirmDeleteCollection: 'Are you sure you want to delete this collection? This cannot be undone.',
        deleteBtn: 'Delete',
        savingBtn: 'Saving...',
        updateBtn: 'Update',
        createBtn: 'Create',
        collectionContents: 'Contents',
        doneBtn: 'Done',
        addContentBtn: '+ Add Content',
        addBtn: 'Add',
        emptyCollection: 'This collection is empty.',
        searchKnowledgeToAdd: 'Search knowledge to add...',
        noMatchingKnowledge: 'No matching knowledge found to add.',
        confirmRemoveFromCollection: 'Remove this item from collection?',
        collectionNoDesc: 'No description',
        collectionItemCount: 'items',
        collectionNameRequired: 'Collection name is required',
        collectionNameMinLength: 'Name must be at least 2 characters',
        deletingBtn: 'Deleting...',
        removeFromCollectionBtn: 'Remove from collection',
        emptyCollectionHint: 'Click "+ Add Content" to add knowledge to this collection',
        noCollectionsFound: 'No collections found',
        noCollectionsHint: 'Create a collection to organize your knowledge',
        openBtn: 'Open',

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

        // Upload Knowledge
        uploadTitle: 'Upload Knowledge',
        fileUploadMode: '📄 File Upload',
        rawTextMode: '📝 Raw Text',
        fromUrlMode: '🔗 From URL',
        selectFilesLimit: 'Select Files (PDF, Office, Text, Code, Images) — up to',
        dropFilesHint: 'Drop files here or click to browse',
        websiteUrlLabel: 'Website URL',
        urlInputPlaceholder: 'https://example.com/page',
        urlExtractionHint: 'The page content will be extracted and saved as knowledge.',
        docTitleLabel: 'Document Title',
        docTitlePlaceholder: 'e.g. My Important Notes',
        textContentLabel: 'Text Content',
        textInputPlaceholder: 'Paste your raw text or notes here...',
        textConversionHint: 'This text will be converted into a searchable document.',
        visibilityLabel: 'Visibility',
        visPersonalOpt: 'Personal (Private)',
        visDeptOpt: 'Department',
        visPublicOpt: 'Public (All)',
        visPolicyOpt: 'Policy (System)',
        hintVisPersonal: 'Only you can see this.',
        hintVisDept: 'Visible to everyone in',
        hintVisPublic: 'Visible to everyone in the university.',
        hintVisPolicy: 'Enforced system-wide context (Admin Only).',
        folderPathLabel: 'Folder Path (Optional)',
        folderPathPlaceholder: 'e.g. HR/Policies/2023',
        folderPathHint: 'Organize with virtual folders.',
        expiryDateLabel: 'Expiry / Review Date (Optional)',
        expiryDateHint: 'Mark for review after this date.',
        uploadingStatus: 'Uploading',
        scrapingStatus: 'Scraping page...',
        pastingStatus: 'Pasting content into database...',
        cancelBtn: 'Cancel',
        processingBtn: 'Processing...',
        importBtn: 'Import',
        uploadBtnText: 'Upload',
    }
}

// ─── Theme Composable ───────────────────────────────────────────
export function useTheme() {
    const applyTheme = () => {
        const theme = isDark.value ? 'dark' : 'light'
        const bgColor = isDark.value ? '#0f0f0f' : '#ffffff'

        // Set both data-theme (app custom) and data-coreui-theme (CoreUI framework)
        document.documentElement.setAttribute('data-theme', theme)
        document.documentElement.setAttribute('data-coreui-theme', theme)
        localStorage.setItem(THEME_KEY, theme)

        // Safari 26+: color-scheme on <html> tells the browser which scheme we're using
        // This directly controls the browser chrome (status bar + URL bar) color
        document.documentElement.style.colorScheme = theme

        // Set <html> background so Safari picks up the correct color for browser chrome
        // Safari uses the actual rendered background at the top/bottom of the viewport
        document.documentElement.style.backgroundColor = bgColor

        // Also update <meta name="theme-color"> for Safari/Chrome browser chrome
        const metaTheme = document.getElementById('meta-theme-color')
            || document.querySelector('meta[name="theme-color"]')
        if (metaTheme) {
            metaTheme.setAttribute('content', bgColor)
        }
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
