<template>
  <div class="apikey-manager">
    <!-- Header -->
    <header class="manager-header">
      <div class="header-content">
        <div class="header-title">
          <h1>{{ t('title') }}</h1>
          <span class="badge-count">{{ apiKeys.length }}</span>
        </div>
        <div class="header-actions">
          <button @click="openCreateModal" class="btn-primary" id="create-key-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {{ t('newKey') }}
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="manager-body">
      <div class="content-container">
        
        <!-- Loading State -->
        <div v-if="loading" class="state-msg">
            <div class="spinner"></div>
            <p>{{ t('loading') }}</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="apiKeys.length === 0" class="state-msg empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <p>{{ t('noKeys') }}</p>
            <button @click="openCreateModal" class="btn-ghost">{{ t('createFirst') }}</button>
        </div>

        <!-- Key List -->
        <div v-else class="key-grid">
            <div v-for="key in apiKeys" :key="key._id" class="key-card" :class="{ 'revoked': !!key.revokedAt }">
                <div class="key-main">
                    <div class="key-header">
                        <span class="key-name">{{ key.name }}</span>
                        <span v-if="key.revokedAt" class="badge-revoked">{{ t('revoked') }}</span>
                        <span v-else class="badge-active">{{ t('active') }}</span>
                    </div>
                    <div class="key-preview">
                        <code>{{ key.keyPrefix }}••••••••••••••••</code>
                    </div>
                    <div class="key-meta">
                        <div class="meta-item">
                            <span class="meta-label">{{ t('created') }}:</span>
                            <span>{{ formatDate(key.createdAt) }}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">{{ t('lastUsed') }}:</span>
                            <span>{{ key.lastUsedAt ? formatDate(key.lastUsedAt) : t('never') }}</span>
                        </div>
                         <div class="meta-item" v-if="key.expiresAt">
                            <span class="meta-label">{{ t('expires') }}:</span>
                            <span>{{ formatDate(key.expiresAt) }}</span>
                        </div>
                    </div>
                </div>
                <div class="key-actions">
                    <button v-if="!key.revokedAt" @click="revokeKey(key)" class="btn-icon danger" :title="t('revoke')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </main>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ t('createTitle') }}</h3>
          <button @click="closeCreateModal" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>{{ t('keyName') }} <span class="required">*</span></label>
            <input v-model="newItem.name" :placeholder="t('namePlaceholder')" class="input-std" ref="nameInput" />
          </div>
          <div class="form-row">
             <label>{{ t('expiration') }}</label>
             <select v-model="newItem.expiration" class="input-std">
                 <option value="">{{ t('neverExpire') }}</option>
                 <option value="30d">30 {{ t('days') }}</option>
                 <option value="90d">90 {{ t('days') }}</option>
                 <option value="1y">1 {{ t('year') }}</option>
             </select>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeCreateModal" class="btn-ghost">{{ t('cancel') }}</button>
          <button @click="createKey" :disabled="!newItem.name || creating" class="btn-primary">
            {{ creating ? t('creating') : t('create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Success/Copy Modal -->
    <div v-if="showSuccessModal" class="modal-overlay">
        <div class="modal-card success-card">
            <div class="modal-header">
                <div class="success-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    <h3>{{ t('keyCreated') }}</h3>
                </div>
            </div>
            <div class="modal-body">
                <p class="warning-text">{{ t('copyWarning') }}</p>
                <div class="key-display">
                    <code>{{ createdKey }}</code>
                    <button @click="copyKey" class="btn-copy" :class="{ copied: isCopied }">
                        <span v-if="isCopied">{{ t('copied') }}</span>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                </div>
            </div>
            <div class="modal-actions">
                <button @click="closeSuccessModal" class="btn-primary full-width">{{ t('done') }}</button>
            </div>
        </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../utils/api'
import { useLanguage } from '../../composables/useSettings'

const { lang } = useLanguage()

// ── i18n ────────────────────────────────────────────────────────
const translations = {
  th: {
    title: 'API Keys',
    newKey: 'สร้าง Key ใหม่',
    loading: 'กำลังโหลด...',
    noKeys: 'ไม่พบ API Key',
    createFirst: 'สร้าง Key แรกของคุณ',
    active: 'ใช้งาน',
    revoked: 'ยกเลิกแล้ว',
    created: 'สร้างเมื่อ',
    lastUsed: 'ใช้งานล่าสุด',
    expires: 'หมดอายุ',
    never: 'ไม่เคย',
    revoke: 'ยกเลิก Key',
    createTitle: 'สร้าง API Key ใหม่',
    keyName: 'ชื่อ Key',
    namePlaceholder: 'เช่น สำหรับ Production App',
    expiration: 'วันหมดอายุ',
    neverExpire: 'ไม่มีวันหมดอายุ',
    days: 'วัน',
    year: 'ปี',
    cancel: 'ยกเลิก',
    creating: 'กำลังสร้าง...',
    create: 'สร้าง',
    keyCreated: 'สร้าง API Key สำเร็จ!',
    copyWarning: 'โปรดคัดลอก Key นี้เก็บไว้ในที่ปลอดภัย คุณจะไม่สามารถเห็นมันได้อีก',
    copied: 'คัดลอกแล้ว!',
    done: 'เสร็จสิ้น',
    confirmRevoke: 'คุณแน่ใจหรือไม่ที่จะยกเลิก Key นี้? การกระทำนี้ไม่สามารถย้อนกลับได้',
    revokeFailed: 'ยกเลิกไม่สำเร็จ',
    createFailed: 'สร้างไม่สำเร็จ'
  },
  en: {
    title: 'API Keys',
    newKey: 'New API Key',
    loading: 'Loading...',
    noKeys: 'No API Keys found.',
    createFirst: 'Create your first key',
    active: 'Active',
    revoked: 'Revoked',
    created: 'Created',
    lastUsed: 'Last Used',
    expires: 'Expires',
    never: 'Never',
    revoke: 'Revoke Key',
    createTitle: 'Create New API Key',
    keyName: 'Key Name',
    namePlaceholder: 'e.g. My Production App',
    expiration: 'Expiration',
    neverExpire: 'Never Expires',
    days: 'days',
    year: 'year',
    cancel: 'Cancel',
    creating: 'Creating...',
    create: 'Create',
    keyCreated: 'API Key Created!',
    copyWarning: 'Please copy this key and save it somewhere safe. You won\'t be able to see it again.',
    copied: 'Copied!',
    done: 'Done',
    confirmRevoke: 'Are you sure you want to revoke this key? This action cannot be undone.',
    revokeFailed: 'Revoke failed',
    createFailed: 'Create failed'
  }
}
const t = (key) => translations[lang.value]?.[key] || translations.en[key] || key

// ── State ────────────────────────────────────────────────────────
const apiKeys = ref([])
const loading = ref(false)
const creating = ref(false)

// Create Modal
const showCreateModal = ref(false)
const newItem = ref({ name: '', expiration: '' })

// Success Modal
const showSuccessModal = ref(false)
const createdKey = ref('')
const isCopied = ref(false)

// ── API ──────────────────────────────────────────────────────────
const fetchKeys = async () => {
  loading.value = true
  try {
    const res = await api.get('/keys')
    apiKeys.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch keys:', e)
  } finally {
    loading.value = false
  }
}

const createKey = async () => {
    creating.value = true
    try {
        let expiresAt = null
        const now = new Date()
        if (newItem.value.expiration === '30d') expiresAt = new Date(now.setDate(now.getDate() + 30))
        else if (newItem.value.expiration === '90d') expiresAt = new Date(now.setDate(now.getDate() + 90))
        else if (newItem.value.expiration === '1y') expiresAt = new Date(now.setFullYear(now.getFullYear() + 1))

        const res = await api.post('/keys', {
            name: newItem.value.name,
            expiresAt: expiresAt
        })
        
        createdKey.value = res.data.key
        // Add minimal placeholder to list (refreshing will get full details)
        await fetchKeys()
        
        closeCreateModal()
        showSuccessModal.value = true
    } catch (e) {
        alert(t('createFailed') + ': ' + (e.response?.data?.error || e.message))
    } finally {
        creating.value = false
    }
}

const revokeKey = async (key) => {
    if (!confirm(t('confirmRevoke'))) return
    
    try {
        await api.delete(`/keys/${key._id}`)
        // Optimistic update
        const idx = apiKeys.value.findIndex(k => k._id === key._id)
        if (idx !== -1) {
            apiKeys.value[idx].revokedAt = new Date().toISOString()
        }
    } catch (e) {
        alert(t('revokeFailed'))
    }
}

// ── Helpers ──────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(lang.value === 'th' ? 'th-TH' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

const copyKey = async () => {
    try {
        await navigator.clipboard.writeText(createdKey.value)
        isCopied.value = true
        setTimeout(() => isCopied.value = false, 2000)
    } catch (err) {
        console.error('Failed to copy', err)
    }
}

const openCreateModal = () => {
    newItem.value = { name: '', expiration: '' }
    showCreateModal.value = true
}
const closeCreateModal = () => { showCreateModal.value = false }
const closeSuccessModal = () => { showSuccessModal.value = false; createdKey.value = '' }

onMounted(() => {
  fetchKeys()
})
</script>

<style scoped>
.apikey-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: 'Inter', -apple-system, sans-serif;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────── */
.manager-header {
  height: 60px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-primary) 100%);
}
.header-content { width: 100%; display: flex; justify-content: space-between; align-items: center; }
.header-title { display: flex; align-items: center; gap: 12px; }
.header-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
.badge-count {
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 11px; padding: 3px 10px; border-radius: 99px; font-weight: 700;
}
.btn-primary {
    background: var(--color-accent);
    color: white; border: none;
    padding: 8px 16px; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    transition: all 0.2s;
}
.btn-primary:hover { filter: brightness(110%); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

/* ── Body ────────────────────────────────────────────── */
.manager-body { 
    flex: 1; 
    overflow-y: auto; 
    padding: 24px;
    background: var(--color-bg-secondary);
}
.content-container {
    max-width: 1000px;
    margin: 0 auto;
}

.state-msg {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px; color: var(--color-text-muted);
    gap: 16px;
}
.state-msg.empty svg { opacity: 0.5; }
.spinner {
    width: 24px; height: 24px; border: 3px solid var(--color-border);
    border-top-color: var(--color-accent); border-radius: 50%;
    animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Grid ────────────────────────────────────────────── */
.key-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
}
.key-card {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    display: flex; justify-content: space-between;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.key-card:hover { border-color: var(--color-accent); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.key-card.revoked { opacity: 0.6; filter: grayscale(1); }

.key-main { flex: 1; min-width: 0; }
.key-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.key-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.badge-active {
    font-size: 10px; background: rgba(16,185,129,0.15); color: #10b981;
    padding: 2px 8px; border-radius: 99px; font-weight: 700; border: 1px solid rgba(16,185,129,0.2);
}
.badge-revoked {
    font-size: 10px; background: rgba(239,68,68,0.15); color: #ef4444;
    padding: 2px 8px; border-radius: 99px; font-weight: 700; border: 1px solid rgba(239,68,68,0.2);
}

.key-preview {
    margin-bottom: 12px;
}
.key-preview code {
    background: var(--color-bg-input);
    padding: 4px 8px; border-radius: 6px;
    font-family: 'Consolas', monospace; font-size: 12px;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
}

.key-meta { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--color-text-muted); }
.meta-item { display: flex; justify-content: space-between; }
.meta-label { font-weight: 500; }

.key-actions {
    display: flex; flex-direction: column; gap: 4px; border-left: 1px solid var(--color-border);
    padding-left: 12px; margin-left: 12px; justify-content: center;
}
.btn-icon {
    background: transparent; border: none; cursor: pointer;
    padding: 8px; border-radius: 6px; color: var(--color-text-muted);
    transition: all 0.2s;
}
.btn-icon:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }
.btn-icon.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

/* ── Modal ───────────────────────────────────────────── */
.modal-overlay {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center;
}
.modal-card {
    background: var(--color-bg-primary);
    width: 400px; max-width: 90vw;
    border-radius: 16px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    border: 1px solid var(--color-border);
    animation: scaleIn 0.2s ease-out;
}
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; }}

.modal-header {
    padding: 16px 20px; border-bottom: 1px solid var(--color-border);
    display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-muted); }

.modal-body { padding: 20px; }
.form-row { margin-bottom: 16px; }
.form-row label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--color-text-secondary); }
.required { color: #ef4444; }
.input-std {
    width: 100%; background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    padding: 10px; border-radius: 8px;
    color: var(--color-text-primary); font-size: 13px;
    outline: none; transition: border-color 0.2s;
}
.input-std:focus { border-color: var(--color-accent); }

.modal-actions {
    padding: 16px 20px; border-top: 1px solid var(--color-border);
    display: flex; justify-content: flex-end; gap: 12px;
    background: var(--color-bg-tertiary);
    border-radius: 0 0 16px 16px;
}
.btn-ghost {
    background: transparent; border: 1px solid var(--color-border);
    padding: 8px 16px; border-radius: 8px;
    color: var(--color-text-primary); cursor: pointer; font-size: 13px;
    transition: all 0.2s;
}
.btn-ghost:hover { background: var(--color-bg-hover); }

/* Success Card */
.success-title { display: flex; align-items: center; gap: 8px; color: #10b981; }
.warning-text { font-size: 13px; color: #f59e0b; background: rgba(245,158,11,0.1); padding: 10px; border-radius: 8px; margin-bottom: 16px; }
.key-display {
    display: flex; gap: 8px; margin-bottom: 8px;
}
.key-display code {
    flex: 1; background: var(--color-bg-input); border: 1px solid var(--color-border);
    padding: 10px; border-radius: 8px; font-family: 'Consolas', monospace; font-size: 14px;
    word-break: break-all;
}
.btn-copy {
    background: var(--color-bg-input); border: 1px solid var(--color-border);
    width: 40px; border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-text-secondary); transition: all 0.2s;
}
.btn-copy:hover { color: var(--color-accent); border-color: var(--color-accent); }
.btn-copy.copied { color: #10b981; border-color: #10b981; }

.full-width { width: 100%; justify-content: center; }

</style>
