export const AGENT_CONSTANTS = {
    // File Processing
    MAX_NATIVE_FILE_SIZE: 4.5 * 1024 * 1024, // 4.5MB
    MAX_EXTRACTED_TEXT_CHARS: 100_000,
    SUPPORTED_FILE_FORMATS: ['pdf', 'txt', 'md', 'html', 'csv', 'doc', 'docx', 'xls', 'xlsx'],

    // Agent Loop
    MAX_AGENT_STEPS: 20,
    AGENT_TIMEOUT_MS: 300_000, // 5 minutes

    // Timeouts (ms)
    OCR_JOB_TIMEOUT: 60_000,

    // History
    HISTORY_WINDOW_SIZE: 10,

    // UI
    RESULT_PREVIEW_CHARS: 300,
} as const;
