/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  // เพิ่ม environment variables อื่นๆ ตามต้องการ
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
