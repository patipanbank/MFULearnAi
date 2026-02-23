<template>
  <div class="tool-manager">
    <!-- Header -->
    <header class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        </div>
        <div>
          <h1 class="page-title">Tool Access Control</h1>
          <p class="page-desc">จัดการสิทธิ์การเข้าถึง AI Agent Tools ตาม Role</p>
        </div>
      </div>
      <div class="header-right">
        <span class="count-badge">
          {{ enabledCount }}/{{ tools.length }} enabled
        </span>
        <button @click="fetchTools" class="btn btn-ghost btn-sm" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="page-body">
      <div class="content-wrap">

        <!-- Loading -->
        <div v-if="loading" class="state-empty">
          <div class="spinner"></div>
          <p>กำลังโหลด...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="state-empty state-error">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <p class="empty-title">{{ error }}</p>
          <button @click="fetchTools" class="btn btn-accent">ลองใหม่</button>
        </div>

        <!-- Empty -->
        <div v-else-if="tools.length === 0" class="state-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <p class="empty-title">ไม่พบ Tools</p>
          <p class="empty-desc">ยังไม่มี tools ที่โหลดในระบบ กรุณาตรวจสอบ backend</p>
        </div>

        <!-- Tool List -->
        <div v-else class="tool-list">
          <article
            v-for="tool in tools"
            :key="tool.toolName"
            class="tool-card"
            :class="{
              'is-disabled': tool.isDisabled,
              'is-saving': saving === tool.toolName,
              'has-override': tool.hasDbOverride
            }"
          >
            <!-- Left accent bar -->
            <div class="card-accent" :class="tool.isDisabled ? 'accent-off' : 'accent-on'"></div>

            <div class="card-content">
              <!-- Top row: name, badges, toggle -->
              <div class="card-top">
                <div class="tool-identity">
                  <div class="tool-name-row">
                    <h3 class="tool-name">{{ tool.toolName }}</h3>
                    <span class="source-badge" :class="tool.source === 'mcp' ? 'badge-mcp' : 'badge-builtin'">
                      {{ tool.source === 'mcp' ? 'MCP' : 'Built-in' }}
                    </span>
                    <span v-if="tool.hasDbOverride" class="override-badge">Customized</span>
                  </div>
                  <p v-if="tool.description" class="tool-desc">{{ tool.description }}</p>
                </div>

                <label class="toggle" :for="`toggle-${tool.toolName}`">
                  <input
                    :id="`toggle-${tool.toolName}`"
                    type="checkbox"
                    :checked="!tool.isDisabled"
                    @change="tool.isDisabled = !$event.target.checked"
                  />
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>

              <!-- Role chips -->
              <div class="roles-section" :class="{ 'section-disabled': tool.isDisabled }">
                <div class="roles-label">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Allowed Roles
                </div>
                <div class="role-chips">
                  <button
                    v-for="role in availableRoles"
                    :key="role"
                    class="chip"
                    :class="{
                      'chip-active': tool.allowedRoles.includes(role),
                      'chip-all': role === '*'
                    }"
                    :disabled="tool.isDisabled"
                    @click="toggleRole(tool, role)"
                  >
                    {{ roleDisplay(role) }}
                  </button>
                </div>
              </div>

              <!-- Actions -->
              <div class="card-actions">
                <button
                  v-if="tool.hasDbOverride"
                  class="btn btn-ghost btn-sm"
                  :disabled="saving === tool.toolName"
                  @click="resetToDefault(tool)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  Reset
                </button>
                <button
                  class="btn btn-accent btn-sm"
                  :disabled="saving === tool.toolName"
                  @click="saveAccess(tool)"
                >
                  <span v-if="saving === tool.toolName" class="btn-spinner"></span>
                  <template v-else>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save
                  </template>
                </button>
              </div>
            </div>
          </article>
        </div>

      </div>
    </main>

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
import api from '@/utils/api'

// ── State ───────────────────────────────────────────────────────
const loading = ref(true)
const saving = ref(null)
const tools = ref([])
const availableRoles = ref(['*', 'student', 'staff', 'admin', 'superadmin'])
const error = ref(null)
const toast = ref({ show: false, message: '', type: 'success' })

// ── Computed ────────────────────────────────────────────────────
const enabledCount = computed(() => tools.value.filter(t => !t.isDisabled).length)

// ── Toast ────────────────────────────────────────────────────────
const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

// ── API ──────────────────────────────────────────────────────────
const fetchTools = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await api.get('/tools/access')
    tools.value = response.data.tools || []
    availableRoles.value = response.data.availableRoles || availableRoles.value
  } catch (err) {
    error.value = 'ไม่สามารถโหลดข้อมูล tools ได้ — ตรวจสอบ Nginx proxy rule'
    console.error('[AdminToolAccess] fetch failed:', err)
  } finally {
    loading.value = false
  }
}

const saveAccess = async (tool) => {
  saving.value = tool.toolName
  try {
    await api.put(`/tools/access/${tool.toolName}`, {
      allowedRoles: tool.allowedRoles.length > 0 ? tool.allowedRoles : ['*'],
      isDisabled: tool.isDisabled,
      description: tool.description
    })
    showToast(`บันทึก ${tool.toolName} สำเร็จ`)
  } catch (err) {
    showToast(`บันทึก ${tool.toolName} ไม่สำเร็จ`, 'error')
    console.error(`[AdminToolAccess] save failed for ${tool.toolName}:`, err)
  } finally {
    saving.value = null
  }
}

const resetToDefault = async (tool) => {
  if (!confirm(`รีเซ็ต "${tool.toolName}" เป็นค่าเริ่มต้นจาก code?`)) return
  saving.value = tool.toolName
  try {
    await api.delete(`/tools/access/${tool.toolName}`)
    showToast(`รีเซ็ต ${tool.toolName} สำเร็จ`)
    await fetchTools()
  } catch (err) {
    showToast(`รีเซ็ต ${tool.toolName} ไม่สำเร็จ`, 'error')
  } finally {
    saving.value = null
  }
}

// ── Helpers ──────────────────────────────────────────────────────
const toggleRole = (tool, role) => {
  if (role === '*') {
    tool.allowedRoles = tool.allowedRoles.includes('*') ? [] : ['*']
    return
  }
  // Remove wildcard when selecting specific roles
  tool.allowedRoles = tool.allowedRoles.filter(r => r !== '*')
  const idx = tool.allowedRoles.indexOf(role)
  idx >= 0 ? tool.allowedRoles.splice(idx, 1) : tool.allowedRoles.push(role)
  // Auto-disable if no roles
  if (tool.allowedRoles.length === 0) tool.isDisabled = true
}

const ROLE_LABELS = {
  '*': 'ทุกคน (All)',
  student: 'Student',
  staff: 'Staff',
  admin: 'Admin',
  superadmin: 'Superadmin'
}
const roleDisplay = (role) => ROLE_LABELS[role] || role

onMounted(fetchTools)
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────── */
.tool-manager {
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
.header-right { display: flex; align-items: center; gap: 10px; }
.count-badge {
  font-size: 12px; font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  padding: 4px 12px; border-radius: 99px;
}

/* ── Buttons ─────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600; border: none;
  cursor: pointer; transition: all 0.15s;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-accent { background: var(--color-accent); color: #fff; }
.btn-accent:hover:not(:disabled) { background: var(--color-accent-hover); }
.btn-ghost {
  background: transparent; color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.btn-ghost:hover:not(:disabled) { background: var(--color-bg-hover); }

.btn-spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* ── Body ────────────────────────────────────────────── */
.page-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
.content-wrap { max-width: 800px; margin: 0 auto; }

/* ── States ──────────────────────────────────────────── */
.state-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 20px;
  color: var(--color-text-muted); gap: 12px; text-align: center;
}
.state-error svg { color: var(--color-error); opacity: 0.6; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--color-text-secondary); margin: 0; }
.empty-desc { font-size: 13px; margin: 0; }

.spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Tool List ───────────────────────────────────────── */
.tool-list { display: flex; flex-direction: column; gap: 12px; }

.tool-card {
  position: relative;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  overflow: hidden;
  transition: all 0.2s;
}
.tool-card:hover { border-color: var(--color-accent); box-shadow: var(--shadow-sm); }
.tool-card.is-disabled { opacity: 0.6; }
.tool-card.is-disabled:hover { border-color: var(--color-border); box-shadow: none; }
.tool-card.is-saving { pointer-events: none; opacity: 0.8; }

.card-accent { width: 3px; flex-shrink: 0; }
.accent-on { background: var(--color-success); }
.accent-off { background: var(--color-text-muted); }
.tool-card.has-override .accent-on { background: var(--color-accent); }

.card-content { flex: 1; padding: 18px 20px; }

/* Top row */
.card-top {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 16px; margin-bottom: 14px;
}
.tool-identity { flex: 1; min-width: 0; }
.tool-name-row {
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap; margin-bottom: 4px;
}
.tool-name {
  margin: 0; font-size: 15px; font-weight: 600;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
.tool-desc { margin: 0; font-size: 12px; color: var(--color-text-muted); line-height: 1.5; }

/* Badges */
.source-badge, .override-badge {
  font-size: 10px; font-weight: 700; padding: 2px 8px;
  border-radius: 6px; letter-spacing: 0.03em;
}
.badge-builtin { background: rgba(59,130,246,0.1); color: #3b82f6; }
.badge-mcp { background: rgba(168,85,247,0.1); color: #a855f7; }
.override-badge { background: rgba(245,158,11,0.1); color: #f59e0b; }

/* Toggle */
.toggle {
  position: relative; display: inline-block;
  width: 44px; height: 24px; flex-shrink: 0; cursor: pointer;
}
.toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.toggle-track {
  position: absolute; inset: 0;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 24px;
  transition: all 0.25s;
}
.toggle-thumb {
  position: absolute;
  width: 18px; height: 18px;
  left: 2px; top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.25s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle input:checked + .toggle-track {
  background: var(--color-accent);
  border-color: var(--color-accent);
}
.toggle input:checked + .toggle-track .toggle-thumb {
  transform: translateX(20px);
}

/* Roles */
.roles-section { margin-bottom: 14px; transition: opacity 0.2s; }
.section-disabled { opacity: 0.35; pointer-events: none; }
.roles-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;
}
.role-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-size: 12px; font-weight: 500;
  padding: 5px 14px; border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  cursor: pointer; transition: all 0.15s;
}
.chip:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.chip.chip-active {
  background: var(--color-accent); color: #fff; border-color: var(--color-accent);
}
.chip.chip-all.chip-active {
  background: var(--color-success); border-color: var(--color-success);
}
.chip:disabled { cursor: not-allowed; opacity: 0.5; }

/* Actions */
.card-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 12px; border-top: 1px solid var(--color-border);
}

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
  .card-top { flex-direction: column; }
  .card-actions { flex-direction: column; }
  .card-actions .btn { justify-content: center; }
}
</style>
