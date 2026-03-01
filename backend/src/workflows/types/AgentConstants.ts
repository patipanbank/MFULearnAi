export const AGENT_CONSTANTS = {
    // File Processing
    MAX_NATIVE_FILE_SIZE: 4.5 * 1024 * 1024, // 4.5MB
    MAX_EXTRACTED_TEXT_CHARS: 100_000,
    SUPPORTED_FILE_FORMATS: ['pdf', 'txt', 'md', 'html', 'csv', 'doc', 'docx', 'xls', 'xlsx'],

    // Agent Loop
    MAX_AGENT_STEPS: 20,
    AGENT_TIMEOUT_MS: 300_000, // 5 minutes

    // LLM Retry Policy
    LLM_MAX_RETRIES: 3,
    LLM_RETRY_BASE_DELAY_MS: 1_000,   // 1s → 2s → 4s exponential backoff
    LLM_RETRYABLE_ERRORS: ['ThrottlingException', 'ServiceUnavailableException', 'InternalServerException', 'ECONNRESET', 'ETIMEDOUT'],

    // Tool Execution
    TOOL_TIMEOUT_MS: 30_000, // 30s per individual tool call

    // Timeouts (ms)
    OCR_JOB_TIMEOUT: 60_000,

    // History
    HISTORY_WINDOW_SIZE: 10,

    // UI
    RESULT_PREVIEW_CHARS: 300,
} as const;

/** Centralized Thai-language user-facing messages */
export const AGENT_MESSAGES = {
    ERROR_GENERIC: 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง',
    ERROR_TIMEOUT: 'ขออภัยครับ คำขอใช้เวลาเกินกำหนด กรุณาลองถามใหม่อีกครั้ง',
    STATUS_TIMEOUT: 'หมดเวลาดำเนินการ',
    STATUS_LOADING_CONTEXT: 'กำลังโหลดบริบทการสนทนา...',
    STATUS_WAITING_OCR: 'Waiting for OCR processing...',
    STATUS_USING_TOOL: (toolName: string) => `🔧 Using ${toolName}...`,
} as const;
