<template>
  <div class="apikey-manager">
    <!-- Header -->
    <header class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
        </div>
        <div>
          <h1 class="page-title">{{ t('title') }}</h1>
          <p class="page-desc">{{ t('subtitle') }}</p>
        </div>
      </div>
      <div class="header-right">
        <span class="count-badge">{{ apiKeys.length }} {{ t('keys') }}</span>
        <button @click="openCreateModal" class="btn btn-accent" id="create-key-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ t('newKey') }}
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="page-body">
      <div class="content-wrap">

        <!-- Loading -->
        <div v-if="loading" class="state-empty">
          <div class="spinner"></div>
          <p>{{ t('loading') }}</p>
        </div>

        <!-- Empty -->
        <div v-else-if="apiKeys.length === 0" class="state-empty">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          </div>
          <p class="empty-title">{{ t('noKeys') }}</p>
          <p class="empty-desc">{{ t('noKeysDesc') }}</p>
          <button @click="openCreateModal" class="btn btn-accent">{{ t('createFirst') }}</button>
        </div>

        <!-- Key Grid -->
        <div v-else class="key-grid">
          <article
            v-for="key in sortedKeys"
            :key="key._id"
            class="key-card"
            :class="{ 'is-revoked': !!key.revokedAt }"
          >
            <!-- Status indicator -->
            <div class="card-status" :class="key.revokedAt ? 'status-revoked' : 'status-active'"></div>

            <div class="card-body">
              <div class="card-top">
                <div class="card-title-row">
                  <h3 class="key-name">{{ key.name }}</h3>
                  <span class="status-badge" :class="key.revokedAt ? 'badge-revoked' : 'badge-active'">
                    {{ key.revokedAt ? t('revoked') : t('active') }}
                  </span>
                </div>
                <div class="key-preview">
                  <code>{{ key.keyPrefix }}••••••••</code>
                </div>
              </div>

              <div class="card-meta">
                <div class="meta-row">
                  <span class="meta-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {{ t('created') }}
                  </span>
                  <span class="meta-value">{{ formatDate(key.createdAt) }}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {{ t('lastUsed') }}
                  </span>
                  <span class="meta-value" :class="{ 'text-muted': !key.lastUsedAt }">
                    {{ key.lastUsedAt ? formatDate(key.lastUsedAt) : t('never') }}
                  </span>
                </div>
                <div v-if="key.expiresAt" class="meta-row">
                  <span class="meta-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    {{ t('expires') }}
                  </span>
                  <span class="meta-value" :class="{ 'text-warning': isExpiringSoon(key.expiresAt) }">
                    {{ formatDate(key.expiresAt) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="card-actions">
              <button
                v-if="!key.revokedAt"
                @click="revokeKey(key)"
                class="btn-icon btn-danger"
                :title="t('revoke')"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </article>
        </div>

      </div>
    </main>

    <!-- Create Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreateModal" class="modal-backdrop" @click.self="closeCreateModal">
          <div class="modal-panel">
            <div class="modal-header">
              <h3>{{ t('createTitle') }}</h3>
              <button @click="closeCreateModal" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
              <div class="field">
                <label for="key-name">{{ t('keyName') }} <span class="required">*</span></label>
                <input
                  id="key-name"
                  v-model="newItem.name"
                  :placeholder="t('namePlaceholder')"
                  class="input"
                  @keyup.enter="createKey"
                />
              </div>
              <div class="field">
                <label for="key-expiry">{{ t('expiration') }}</label>
                <select id="key-expiry" v-model="newItem.expiration" class="input">
                  <option value="">{{ t('neverExpire') }}</option>
                  <option value="30d">30 {{ t('days') }}</option>
                  <option value="90d">90 {{ t('days') }}</option>
                  <option value="1y">1 {{ t('year') }}</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="closeCreateModal" class="btn btn-ghost">{{ t('cancel') }}</button>
              <button @click="createKey" :disabled="!newItem.name.trim() || creating" class="btn btn-accent">
                <span v-if="creating" class="btn-spinner"></span>
                {{ creating ? t('creating') : t('create') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Success Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showSuccessModal" class="modal-backdrop">
          <div class="modal-panel success-panel">
            <div class="modal-header success-header">
              <div class="success-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <h3>{{ t('keyCreated') }}</h3>
            </div>
            <div class="modal-body">
              <div class="warning-banner">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {{ t('copyWarning') }}
              </div>
              <div class="key-display-row">
                <code class="key-code">{{ createdKey }}</code>
                <button @click="copyKey" class="btn-copy" :class="{ 'is-copied': isCopied }">
                  <span v-if="isCopied">✓</span>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="closeSuccessModal" class="btn btn-accent full-w">{{ t('done') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="toast.show" class="toast" :class="`toast-${toast.type}`">
        <svg v-if="toast.type === 'error'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../utils/api'
import { useLanguage } from '../../composables/useSettings'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

const { confirm: showConfirm } = useConfirmDialog()

const { lang } = useLanguage()

// ── i18n ────────────────────────────────────────────────────────
const I18N = {
  th: {
    title: 'API Keys',
    subtitle: 'จัดการ API Keys สำหรับเข้าถึงระบบผ่าน REST API',
    keys: 'keys',
    newKey: 'สร้าง Key ใหม่',
    loading: 'กำลังโหลด...',
    noKeys: 'ยังไม่มี API Key',
    noKeysDesc: 'สร้าง API Key เพื่อเชื่อมต่อระบบผ่าน REST API',
    createFirst: 'สร้าง Key แรก',
    active: 'ใช้งาน',
    revoked: 'ยกเลิก',
    created: 'สร้างเมื่อ',
    lastUsed: 'ใช้งานล่าสุด',
    expires: 'หมดอายุ',
    never: 'ไม่เคย',
    revoke: 'ยกเลิก Key',
    createTitle: 'สร้าง API Key ใหม่',
    keyName: 'ชื่อ Key',
    namePlaceholder: 'เช่น Production App',
    expiration: 'วันหมดอายุ',
    neverExpire: 'ไม่มีวันหมดอายุ',
    days: 'วัน',
    year: 'ปี',
    cancel: 'ยกเลิก',
    creating: 'กำลังสร้าง...',
    create: 'สร้าง Key',
    keyCreated: 'สร้าง API Key สำเร็จ!',
    copyWarning: 'คัดลอกและเก็บ Key นี้ในที่ปลอดภัย — จะไม่แสดงอีก',
    copied: 'คัดลอกแล้ว!',
    done: 'เสร็จสิ้น',
    confirmRevoke: 'ยกเลิก Key นี้? การกระทำนี้ไม่สามารถย้อนกลับได้',
    revokeFailed: 'ยกเลิกไม่สำเร็จ',
    createFailed: 'สร้างไม่สำเร็จ',
    revokeSuccess: 'ยกเลิก Key สำเร็จ'
  },
  en: {
    title: 'API Keys',
    subtitle: 'Manage API keys for REST API access',
    keys: 'keys',
    newKey: 'New API Key',
    loading: 'Loading...',
    noKeys: 'No API Keys yet',
    noKeysDesc: 'Create an API key to connect via REST API',
    createFirst: 'Create your first key',
    active: 'Active',
    revoked: 'Revoked',
    created: 'Created',
    lastUsed: 'Last used',
    expires: 'Expires',
    never: 'Never',
    revoke: 'Revoke',
    createTitle: 'Create New API Key',
    keyName: 'Key Name',
    namePlaceholder: 'e.g. Production App',
    expiration: 'Expiration',
    neverExpire: 'Never expires',
    days: 'days',
    year: 'year',
    cancel: 'Cancel',
    creating: 'Creating...',
    create: 'Create Key',
    keyCreated: 'API Key Created!',
    copyWarning: 'Copy and save this key somewhere safe — it won\'t be shown again',
    copied: 'Copied!',
    done: 'Done',
    confirmRevoke: 'Revoke this key? This action cannot be undone.',
    revokeFailed: 'Failed to revoke key',
    createFailed: 'Failed to create key',
    revokeSuccess: 'Key revoked successfully'
  }
}
const t = (key) => I18N[lang.value]?.[key] || I18N.en[key] || key

// ── State ───────────────────────────────────────────────────────
const apiKeys = ref([])
const loading = ref(false)
const creating = ref(false)
const showCreateModal = ref(false)
const showSuccessModal = ref(false)
const newItem = ref({ name: '', expiration: '' })
const createdKey = ref('')
const isCopied = ref(false)
const toast = ref({ show: false, message: '', type: 'success' })

// ── Computed ────────────────────────────────────────────────────
const sortedKeys = computed(() =>
  [...apiKeys.value].sort((a, b) => {
    // Active keys first, then by creation date descending
    if (!!a.revokedAt !== !!b.revokedAt) return a.revokedAt ? 1 : -1
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
)

// ── Toast Helper ────────────────────────────────────────────────
const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

// ── API ─────────────────────────────────────────────────────────
const fetchKeys = async () => {
  loading.value = true
  try {
    const res = await api.get('/keys')
    apiKeys.value = res.data || []
  } catch (e) {
    showToast(t('createFailed'), 'error')
  } finally {
    loading.value = false
  }
}

const createKey = async () => {
  if (!newItem.value.name.trim() || creating.value) return
  creating.value = true
  try {
    const expiresAt = computeExpiry(newItem.value.expiration)
    const res = await api.post('/keys', {
      name: newItem.value.name.trim(),
      expiresAt
    })

    createdKey.value = res.data.key
    await fetchKeys()
    closeCreateModal()
    showSuccessModal.value = true
  } catch (e) {
    showToast(`${t('createFailed')}: ${e.response?.data?.error || e.message}`, 'error')
  } finally {
    creating.value = false
  }
}

const revokeKey = async (key) => {
  if (!await showConfirm(t('confirmRevoke'), { variant: 'danger' })) return
  try {
    await api.delete(`/keys/${key._id}`)
    const idx = apiKeys.value.findIndex(k => k._id === key._id)
    if (idx !== -1) apiKeys.value[idx].revokedAt = new Date().toISOString()
    showToast(t('revokeSuccess'))
  } catch (e) {
    showToast(t('revokeFailed'), 'error')
  }
}

// ── Helpers ─────────────────────────────────────────────────────
const computeExpiry = (expiration) => {
  if (!expiration) return null
  const now = new Date()
  const ms = { '30d': 30, '90d': 90 }
  if (ms[expiration]) return new Date(now.getTime() + ms[expiration] * 86400000)
  if (expiration === '1y') return new Date(now.setFullYear(now.getFullYear() + 1))
  return null
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(lang.value === 'th' ? 'th-TH' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

const isExpiringSoon = (dateStr) => {
  if (!dateStr) return false
  return new Date(dateStr) - Date.now() < 7 * 86400000
}

const copyKey = async () => {
  try {
    await navigator.clipboard.writeText(createdKey.value)
    isCopied.value = true
    setTimeout(() => { isCopied.value = false }, 2000)
  } catch { /* fallback: user can manually copy */ }
}

const openCreateModal = () => {
  newItem.value = { name: '', expiration: '' }
  showCreateModal.value = true
}
const closeCreateModal = () => { showCreateModal.value = false }
const closeSuccessModal = () => { showSuccessModal.value = false; createdKey.value = '' }

onMounted(fetchKeys)
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────── */
.apikey-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────── */
.page-header {
  height: 64px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  background: var(--color-bg-primary);
}
.header-left { display: flex; align-items: center; gap: 14px; }
.header-icon {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: var(--radius-md);
}
.page-title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
.page-desc { margin: 0; font-size: 12px; color: var(--color-text-muted); }
.header-right { display: flex; align-items: center; gap: 12px; }
.count-badge {
  font-size: 12px; font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  padding: 4px 12px; border-radius: 99px;
}

/* ── Buttons ─────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600; border: none;
  cursor: pointer; transition: all 0.2s;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-accent {
  background: var(--color-accent); color: #fff;
}
.btn-accent:hover:not(:disabled) { background: var(--color-accent-hover); transform: translateY(-1px); }
.btn-ghost {
  background: transparent; color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.btn-ghost:hover { background: var(--color-bg-hover); }
.btn-icon {
  background: transparent; border: none; cursor: pointer;
  padding: 8px; border-radius: var(--radius-sm);
  color: var(--color-text-muted); transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.btn-danger:hover { background: rgba(239,68,68,0.1); color: var(--color-error); }

.btn-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* ── Body ────────────────────────────────────────────── */
.page-body {
  flex: 1; overflow-y: auto; padding: 24px 28px;
}
.content-wrap { max-width: 960px; margin: 0 auto; }

/* ── States ──────────────────────────────────────────── */
.state-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 20px;
  color: var(--color-text-muted); gap: 12px; text-align: center;
}
.empty-icon { opacity: 0.3; margin-bottom: 4px; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--color-text-secondary); margin: 0; }
.empty-desc { font-size: 13px; margin: 0 0 8px; }

.spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Key Grid ────────────────────────────────────────── */
.key-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.key-card {
  position: relative;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 18px 18px 18px 22px;
  display: flex; gap: 12px;
  transition: all 0.2s;
  overflow: hidden;
}
.key-card:hover { border-color: var(--color-accent); box-shadow: var(--shadow-md); }
.key-card.is-revoked { opacity: 0.55; }
.key-card.is-revoked:hover { border-color: var(--color-border); box-shadow: none; }

.card-status {
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
}
.status-active { background: var(--color-success); }
.status-revoked { background: var(--color-error); }

.card-body { flex: 1; min-width: 0; }
.card-top { margin-bottom: 14px; }
.card-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.key-name {
  margin: 0; font-size: 14px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.status-badge {
  font-size: 10px; font-weight: 700; padding: 2px 8px;
  border-radius: 99px; letter-spacing: 0.02em; flex-shrink: 0;
}
.badge-active { background: rgba(34,197,94,0.12); color: var(--color-success); border: 1px solid rgba(34,197,94,0.2); }
.badge-revoked { background: rgba(239,68,68,0.1); color: var(--color-error); border: 1px solid rgba(239,68,68,0.2); }

.key-preview code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px; background: var(--color-bg-tertiary);
  padding: 3px 8px; border-radius: var(--radius-sm);
  color: var(--color-text-muted); border: 1px solid var(--color-border);
}

.card-meta { display: flex; flex-direction: column; gap: 6px; }
.meta-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px;
}
.meta-label {
  display: flex; align-items: center; gap: 5px;
  color: var(--color-text-muted); font-weight: 500;
}
.meta-value { color: var(--color-text-secondary); }
.text-muted { color: var(--color-text-muted) !important; font-style: italic; }
.text-warning { color: var(--color-warning) !important; font-weight: 600; }

.card-actions {
  display: flex; align-items: center;
  border-left: 1px solid var(--color-border);
  padding-left: 12px;
}

/* ── Modal ───────────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.modal-panel {
  background: var(--color-bg-primary);
  width: 420px; max-width: 92vw;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
}
.modal-header {
  padding: 18px 22px; border-bottom: 1px solid var(--color-border);
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.btn-close {
  background: none; border: none; font-size: 22px;
  cursor: pointer; color: var(--color-text-muted);
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.btn-close:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }

.modal-body { padding: 22px; }
.modal-footer {
  padding: 16px 22px; border-top: 1px solid var(--color-border);
  display: flex; justify-content: flex-end; gap: 10px;
  background: var(--color-bg-secondary);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* ── Form ────────────────────────────────────────────── */
.field { margin-bottom: 18px; }
.field:last-child { margin-bottom: 0; }
.field label {
  display: block; font-size: 12px; font-weight: 600;
  color: var(--color-text-secondary); margin-bottom: 6px;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.required { color: var(--color-error); }
.input {
  width: 100%; background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  padding: 10px 12px; border-radius: var(--radius-sm);
  color: var(--color-text-primary); font-size: 13px;
  outline: none; transition: border-color 0.2s;
}
.input:focus { border-color: var(--color-accent); }

/* ── Success Modal ───────────────────────────────────── */
.success-header {
  justify-content: flex-start !important; gap: 10px;
}
.success-badge {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(34,197,94,0.12); color: var(--color-success);
  border-radius: 50%;
}

.warning-banner {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--color-warning);
  background: rgba(245,158,11,0.08);
  padding: 10px 14px; border-radius: var(--radius-sm);
  margin-bottom: 16px; border: 1px solid rgba(245,158,11,0.15);
}

.key-display-row { display: flex; gap: 8px; }
.key-code {
  flex: 1; background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  padding: 10px 12px; border-radius: var(--radius-sm);
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px; word-break: break-all;
  color: var(--color-text-primary);
}
.btn-copy {
  width: 42px; flex-shrink: 0;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-muted); transition: all 0.15s;
  font-size: 14px;
}
.btn-copy:hover { color: var(--color-accent); border-color: var(--color-accent); }
.btn-copy.is-copied { color: var(--color-success); border-color: var(--color-success); }

.full-w { width: 100%; justify-content: center; }

/* ── Toast ────────────────────────────────────────────── */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  z-index: 2000;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 20px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500;
  box-shadow: var(--shadow-lg);
}
.toast-success { background: var(--color-success); color: #fff; }
.toast-error { background: var(--color-error); color: #fff; }

/* ── Transitions ─────────────────────────────────────── */
.modal-enter-active { animation: fadeScale 0.2s ease-out; }
.modal-leave-active { animation: fadeScale 0.15s ease-in reverse; }
@keyframes fadeScale {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.toast-enter-active { animation: slideUp 0.25s ease-out; }
.toast-leave-active { animation: slideUp 0.2s ease-in reverse; }
@keyframes slideUp {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 640px) {
  .page-header { padding: 0 16px; flex-wrap: wrap; height: auto; padding-top: 12px; padding-bottom: 12px; gap: 8px; }
  .header-right { width: 100%; justify-content: space-between; }
  .page-body { padding: 16px; }
  .page-title { font-size: 16px; }
  .key-grid { grid-template-columns: 1fr; }
  .modal-panel { margin: 16px; }
}
</style>
