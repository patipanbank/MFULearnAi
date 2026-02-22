<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isSuperAdmin = computed(() => authStore.role === 'superadmin')

// State
const loading = ref(true)
const saving = ref(null) // toolName that's currently saving
const tools = ref([])
const availableRoles = ref(['*', 'student', 'staff', 'admin', 'superadmin'])
const error = ref(null)
const successMessage = ref(null)

// Fetch all tool configs
const fetchTools = async () => {
    loading.value = true
    error.value = null
    try {
        const response = await api.get('/tools/access')
        tools.value = response.data.tools || []
        availableRoles.value = response.data.availableRoles || availableRoles.value
    } catch (err) {
        error.value = 'ไม่สามารถโหลดข้อมูล tool ได้'
        console.error('Failed to fetch tool access config:', err)
    } finally {
        loading.value = false
    }
}

// Toggle a specific role for a tool
const toggleRole = (tool, role) => {
    // If toggling '*' (all), set to only '*' or remove it
    if (role === '*') {
        if (tool.allowedRoles.includes('*')) {
            tool.allowedRoles = []
        } else {
            tool.allowedRoles = ['*']
        }
        return
    }

    // Remove '*' when selecting specific roles
    tool.allowedRoles = tool.allowedRoles.filter(r => r !== '*')

    const idx = tool.allowedRoles.indexOf(role)
    if (idx >= 0) {
        tool.allowedRoles.splice(idx, 1)
    } else {
        tool.allowedRoles.push(role)
    }

    // If no roles selected, auto-disable
    if (tool.allowedRoles.length === 0) {
        tool.isDisabled = true
    }
}

// Save a tool's access config
const saveAccess = async (tool) => {
    saving.value = tool.toolName
    error.value = null
    successMessage.value = null

    try {
        await api.put(`/tools/access/${tool.toolName}`, {
            allowedRoles: tool.allowedRoles.length > 0 ? tool.allowedRoles : ['*'],
            isDisabled: tool.isDisabled,
            description: tool.description
        })

        successMessage.value = `บันทึก ${tool.toolName} สำเร็จ`
        setTimeout(() => { successMessage.value = null }, 3000)
    } catch (err) {
        error.value = `ไม่สามารถบันทึก ${tool.toolName} ได้`
        console.error(`Failed to save tool access for ${tool.toolName}:`, err)
    } finally {
        saving.value = null
    }
}

// Reset a tool to code defaults
const resetToDefault = async (tool) => {
    if (!confirm(`รีเซ็ต "${tool.toolName}" เป็นค่าเริ่มต้นจาก code?`)) return

    saving.value = tool.toolName
    error.value = null

    try {
        await api.delete(`/tools/access/${tool.toolName}`)
        successMessage.value = `รีเซ็ต ${tool.toolName} สำเร็จ`
        setTimeout(() => { successMessage.value = null }, 3000)
        await fetchTools() // Refresh to show defaults
    } catch (err) {
        error.value = `ไม่สามารถรีเซ็ต ${tool.toolName} ได้`
    } finally {
        saving.value = null
    }
}

// Display helpers
const sourceLabel = (source) => source === 'mcp' ? 'MCP' : 'Built-in'
const sourceClass = (source) => source === 'mcp' ? 'badge-mcp' : 'badge-builtin'
const roleLabel = (role) => {
    const labels = {
        '*': 'ทุกคน',
        'student': 'Student',
        'staff': 'Staff',
        'admin': 'Admin',
        'superadmin': 'Superadmin'
    }
    return labels[role] || role
}

onMounted(fetchTools)
</script>

<template>
  <div class="admin-tool-access">
    <!-- Header -->
    <div class="page-header">
      <div class="header-text">
        <h1 class="page-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          Tool Access Control
        </h1>
        <p class="page-desc">จัดการสิทธิ์การเข้าถึง tools ของ AI Agent ตาม role ของผู้ใช้</p>
      </div>
      <div class="header-info">
        <span class="tool-count">{{ tools.length }} tools</span>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="alert alert-success">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      {{ successMessage }}
    </div>
    <div v-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
      {{ error }}
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>กำลังโหลด...</p>
    </div>

    <!-- Tool Cards -->
    <div v-else class="tool-grid">
      <div
        v-for="tool in tools"
        :key="tool.toolName"
        class="tool-card"
        :class="{
          'is-disabled': tool.isDisabled,
          'is-saving': saving === tool.toolName,
          'has-override': tool.hasDbOverride
        }"
      >
        <!-- Card Header -->
        <div class="card-header">
          <div class="tool-info">
            <div class="tool-name-row">
              <h3 class="tool-name">{{ tool.toolName }}</h3>
              <span class="source-badge" :class="sourceClass(tool.source)">
                {{ sourceLabel(tool.source) }}
              </span>
              <span v-if="tool.hasDbOverride" class="override-badge">Customized</span>
            </div>
            <p class="tool-desc">{{ tool.description }}</p>
          </div>
          <div class="tool-toggle">
            <label class="switch" :for="`toggle-${tool.toolName}`">
              <input
                :id="`toggle-${tool.toolName}`"
                type="checkbox"
                :checked="!tool.isDisabled"
                @change="tool.isDisabled = !$event.target.checked"
              />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- Role Grid -->
        <div class="role-section" :class="{ 'section-disabled': tool.isDisabled }">
          <div class="role-label">Allowed Roles:</div>
          <div class="role-chips">
            <button
              v-for="role in availableRoles"
              :key="role"
              class="role-chip"
              :class="{
                'active': tool.allowedRoles.includes(role),
                'chip-all': role === '*'
              }"
              :disabled="tool.isDisabled"
              @click="toggleRole(tool, role)"
            >
              {{ roleLabel(role) }}
            </button>
          </div>
        </div>

        <!-- Card Actions -->
        <div class="card-actions">
          <button
            v-if="tool.hasDbOverride"
            class="btn btn-ghost"
            :disabled="saving === tool.toolName"
            @click="resetToDefault(tool)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
            Reset to Default
          </button>
          <button
            class="btn btn-primary"
            :disabled="saving === tool.toolName"
            @click="saveAccess(tool)"
          >
            <span v-if="saving === tool.toolName" class="btn-spinner"></span>
            <template v-else>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Save
            </template>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && tools.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
      <p>ไม่พบ tools ที่พร้อมใช้งาน</p>
    </div>
  </div>
</template>

<style scoped>
.admin-tool-access {
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 24px;
}

/* Header */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
}

.page-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 6px 0;
    display: flex;
    align-items: center;
    gap: 10px;
}

.page-desc {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin: 0;
}

.tool-count {
    font-size: 13px;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    padding: 4px 12px;
    border-radius: 20px;
    white-space: nowrap;
}

/* Alerts */
.alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 14px;
    margin-bottom: 16px;
    animation: slideDown 0.2s ease-out;
}

.alert-success {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.2);
}

.alert-error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
}

/* Loading */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 0;
    color: var(--color-text-secondary);
}

.spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}

/* Tool Grid */
.tool-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.tool-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 20px;
    transition: all 0.2s ease;
}

.tool-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.tool-card.is-disabled {
    opacity: 0.6;
}

.tool-card.is-saving {
    pointer-events: none;
    opacity: 0.8;
}

.tool-card.has-override {
    border-left: 3px solid var(--color-accent);
}

/* Card Header */
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
}

.tool-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
}

.tool-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
    font-family: 'SF Mono', 'Fira Code', monospace;
}

.tool-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.5;
}

/* Badges */
.source-badge, .override-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    letter-spacing: 0.03em;
}

.badge-builtin {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
}

.badge-mcp {
    background: rgba(168, 85, 247, 0.1);
    color: #a855f7;
}

.override-badge {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
}

/* Toggle Switch */
.switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
}

.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    transition: 0.3s;
    border-radius: 24px;
}

.slider:before {
    content: "";
    position: absolute;
    height: 18px;
    width: 18px;
    left: 2px;
    bottom: 2px;
    background: white;
    transition: 0.3s;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

input:checked + .slider {
    background: var(--color-accent);
    border-color: var(--color-accent);
}

input:checked + .slider:before {
    transform: translateX(20px);
}

/* Role Section */
.role-section {
    margin-bottom: 16px;
    transition: opacity 0.2s;
}

.section-disabled {
    opacity: 0.4;
    pointer-events: none;
}

.role-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
}

.role-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.role-chip {
    font-size: 13px;
    font-weight: 500;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-primary);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
}

.role-chip:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-accent);
}

.role-chip.active {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
}

.role-chip.chip-all.active {
    background: #10b981;
    border-color: #10b981;
}

.role-chip:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

/* Card Actions */
.card-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
}

.btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary {
    background: var(--color-accent);
    color: white;
}

.btn-primary:hover:not(:disabled) {
    filter: brightness(90%);
    transform: translateY(-1px);
}

.btn-ghost {
    background: transparent;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
}

.btn-ghost:hover:not(:disabled) {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
}

.btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}

/* Empty State */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 0;
    color: var(--color-text-muted);
}

/* Animations */
@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Responsive */
@media (max-width: 640px) {
    .admin-tool-access { padding: 16px; }
    .page-header { flex-direction: column; gap: 12px; }
    .page-title { font-size: 20px; }
    .card-header { flex-direction: column; }
    .card-actions { flex-direction: column; }
    .btn { justify-content: center; }
}
</style>
