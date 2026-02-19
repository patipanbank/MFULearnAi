<template>
  <div class="prompt-manager">
    <!-- Header -->
    <header class="manager-header">
      <div class="header-content">
        <div class="header-title">
          <h1>{{ t('title') }}</h1>
          <span class="badge-count">{{ prompts.length }}</span>
        </div>
        <div class="header-actions">
          <button v-if="isSuperAdmin" @click="openCreateModal" class="btn-primary" id="create-prompt-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {{ t('newPrompt') }}
          </button>
        </div>
      </div>
    </header>

    <!-- Main Layout -->
    <main class="manager-body">
      <!-- Sidebar List -->
      <aside class="sidebar-list">
        <div class="list-controls">
          <input v-model="searchQuery" type="text" :placeholder="t('searchPlaceholder')" class="search-input" id="prompt-search" />
        </div>
        <div class="list-scroll">
          <div v-if="loading" class="empty-msg">{{ t('loading') }}</div>
          <div v-else-if="filteredPrompts.length === 0" class="empty-msg">{{ t('noPrompts') }}</div>
          <button
            v-for="prompt in filteredPrompts"
            :key="prompt._id"
            @click="selectPrompt(prompt)"
            class="list-item"
            :class="{ selected: selectedPrompt?._id === prompt._id }"
            :id="`prompt-item-${prompt.key}`"
          >
            <div class="item-main">
              <span class="item-name">{{ prompt.name }}</span>
              <span v-if="prompt.isActive" class="status-dot" :title="t('active')"></span>
            </div>
            <div class="item-meta">
              <div class="tags">
                <span v-for="tag in prompt.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
              <span class="version">v{{ prompt.activeVersion }}</span>
            </div>
          </button>
        </div>
      </aside>

      <!-- Editor Area -->
      <section class="editor-pane">
        <div v-if="selectedPrompt" class="editor-inner">
          <!-- Toolbar -->
          <div class="editor-header">
            <div class="editor-meta">
              <h2 class="preview-title">{{ selectedPrompt.name }}</h2>
              <code class="preview-key">{{ selectedPrompt.key }}</code>
              <span v-if="selectedPrompt.isActive" class="badge-active">{{ t('active') }}</span>
            </div>
            <div class="editor-actions">
              <!-- Tab Switcher -->
              <div class="tab-group">
                <button
                  v-for="tab in editorTabs"
                  :key="tab.id"
                  class="tab-btn"
                  :class="{ active: activeTab === tab.id }"
                  @click="activeTab = tab.id"
                  :id="`tab-${tab.id}`"
                >{{ t(tab.labelKey) }}</button>
              </div>
              <div class="divider-v"></div>
              <button
                v-if="isSuperAdmin"
                @click="toggleActive"
                :disabled="activating"
                class="btn-text"
                :class="selectedPrompt.isActive ? 'text-danger' : 'text-success'"
                id="toggle-active-btn"
              >{{ activating ? t('processing') : (selectedPrompt.isActive ? t('deactivate') : t('setActive')) }}</button>
              <button
                v-if="isSuperAdmin"
                @click="saveVersion"
                :disabled="!hasChanges || saving || !changeLog"
                class="btn-primary btn-sm"
                id="save-prompt-btn"
              >{{ saving ? t('saving') : t('saveChanges') }}</button>
            </div>
          </div>

          <!-- Changelog Bar -->
          <div v-if="hasChanges" class="changelog-bar">
            <input v-model="changeLog" :placeholder="t('changelogPlaceholder')" class="changelog-input" id="changelog-input" />
          </div>

          <!-- Tab: Editor -->
          <div v-show="activeTab === 'editor'" class="code-wrapper">
            <textarea
              v-model="editBuffer"
              class="monaco-editor"
              spellcheck="false"
              :disabled="!isSuperAdmin"
              id="prompt-editor-textarea"
            ></textarea>
          </div>

          <!-- Tab: Preview -->
          <div v-show="activeTab === 'preview'" class="preview-wrapper">
            <div class="preview-toolbar">
              <button @click="loadPreview" :disabled="loadingPreview" class="btn-ghost btn-sm" id="refresh-preview-btn">
                {{ loadingPreview ? t('loading') : t('refreshPreview') }}
              </button>
            </div>
            <div class="preview-content" v-html="renderedPreviewHtml"></div>
          </div>

          <!-- Tab: Variables -->
          <div v-show="activeTab === 'variables'" class="variables-wrapper">
            <div v-for="category in variableCategories" :key="category" class="var-category">
              <h4 class="var-category-title">{{ category }}</h4>
              <div class="var-grid">
                <button
                  v-for="v in variablesByCategory(category)"
                  :key="v.key"
                  class="var-chip"
                  @click="insertVariable(v.key)"
                  :title="v.description"
                  :id="`var-${v.key}`"
                >
                  <code>{{ '{{' + v.key + '}}' }}</code>
                  <span class="var-label">{{ v.label }}</span>
                  <span class="var-sample">{{ v.sampleValue }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Tab: History -->
          <div v-show="activeTab === 'history'" class="history-wrapper">
            <div v-if="loadingHistory" class="empty-msg">{{ t('loading') }}</div>
            <div v-else-if="versionHistory.length === 0" class="empty-msg">{{ t('noVersions') }}</div>
            <div v-for="ver in versionHistory" :key="ver.version" class="history-item" :class="{ 'is-active': ver.isActive }">
              <div class="history-main">
                <span class="history-version">v{{ ver.version }}</span>
                <span v-if="ver.isActive" class="badge-active-sm">{{ t('current') }}</span>
                <span class="history-date">{{ formatDate(ver.createdAt) }}</span>
              </div>
              <p class="history-log">{{ ver.changelog || '—' }}</p>
              <div class="history-actions">
                <span class="history-size">{{ ver.contentLength }} chars</span>
                <button
                  v-if="isSuperAdmin && !ver.isActive"
                  @click="rollbackTo(ver.version)"
                  class="btn-ghost btn-xs"
                  :disabled="rollingBack"
                >{{ t('rollback') }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-placeholder">
          <div class="placeholder-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            <p>{{ t('selectPrompt') }}</p>
          </div>
        </div>
      </section>
    </main>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ t('createTitle') }}</h3>
          <button @click="closeCreateModal" class="btn-close" id="close-create-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>{{ t('internalKey') }}</label>
            <input v-model="newItem.key" :placeholder="t('keyPlaceholder')" class="input-std" id="new-prompt-key" />
            <p class="input-hint">{{ t('keyHint') }}</p>
          </div>
          <div class="form-row">
            <label>{{ t('displayName') }}</label>
            <input v-model="newItem.name" :placeholder="t('namePlaceholder')" class="input-std" id="new-prompt-name" />
          </div>
          <div class="form-row">
            <label>{{ t('environmentTag') }}</label>
            <select v-model="newItem.tag" class="input-std" id="new-prompt-tag">
              <option value="">{{ t('tagNone') }}</option>
              <option value="PROD">{{ t('tagProd') }}</option>
              <option value="TEST">{{ t('tagTest') }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t('initialContent') }}</label>
            <textarea v-model="newItem.content" class="input-std input-area" id="new-prompt-content"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeCreateModal" class="btn-ghost">{{ t('cancel') }}</button>
          <button @click="createPrompt" :disabled="!newItem.key || creating" class="btn-primary" id="submit-create-btn">
            {{ creating ? t('creating') : t('create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useLanguage } from '../../composables/useSettings'

const authStore = useAuthStore()
const { lang } = useLanguage()
const isSuperAdmin = computed(() => authStore.role === 'superadmin')

// ── i18n ────────────────────────────────────────────────────────
const translations = {
  th: {
    title: 'System Prompts',
    newPrompt: 'สร้างใหม่',
    searchPlaceholder: 'ค้นหา prompts...',
    loading: 'กำลังโหลด...',
    noPrompts: 'ไม่พบ prompt',
    active: 'ใช้งานอยู่',
    editor: 'แก้ไข',
    preview: 'ดูตัวอย่าง',
    variables: 'ตัวแปร',
    history: 'ประวัติ',
    processing: 'กำลังดำเนินการ...',
    deactivate: 'ปิดใช้งาน',
    setActive: 'เปิดใช้งาน',
    saving: 'กำลังบันทึก...',
    saveChanges: 'บันทึก',
    changelogPlaceholder: 'เหตุผลการเปลี่ยนแปลง (จำเป็น)',
    refreshPreview: 'รีเฟรชตัวอย่าง',
    noVersions: 'ไม่มีประวัติ',
    current: 'ปัจจุบัน',
    rollback: 'ย้อนกลับ',
    selectPrompt: 'เลือก prompt จากรายการเพื่อแก้ไข',
    createTitle: 'สร้าง Prompt ใหม่',
    internalKey: 'Internal Key',
    keyPlaceholder: 'เช่น DINDIN_V3_TEST',
    keyHint: 'ต้องไม่ซ้ำ รูปแบบ: NAME_ENV',
    displayName: 'ชื่อแสดง',
    namePlaceholder: 'เช่น DinDin Version 3 (Test)',
    environmentTag: 'Environment (Tag)',
    tagNone: 'ไม่มี (ส่วนตัว)',
    tagProd: 'Production (PROD)',
    tagTest: 'Test / Sandbox (TEST)',
    initialContent: 'เนื้อหาเริ่มต้น',
    cancel: 'ยกเลิก',
    creating: 'กำลังสร้าง...',
    create: 'สร้าง',
    confirmActivate: 'คุณแน่ใจหรือไม่ที่จะ',
    confirmRollback: 'ย้อนกลับไปเวอร์ชัน',
    changelogRequired: 'กรุณากรอกเหตุผลการเปลี่ยนแปลง',
    saved: 'บันทึกสำเร็จ!',
    discardChanges: 'คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการละทิ้งหรือไม่?',
  },
  en: {
    title: 'System Prompts',
    newPrompt: 'New Prompt',
    searchPlaceholder: 'Search prompts...',
    loading: 'Loading...',
    noPrompts: 'No prompts found.',
    active: 'Active',
    editor: 'Editor',
    preview: 'Preview',
    variables: 'Variables',
    history: 'History',
    processing: 'Processing...',
    deactivate: 'Deactivate',
    setActive: 'Set Active',
    saving: 'Saving...',
    saveChanges: 'Save Changes',
    changelogPlaceholder: 'Reason for change (required)',
    refreshPreview: 'Refresh Preview',
    noVersions: 'No versions found.',
    current: 'Current',
    rollback: 'Rollback',
    selectPrompt: 'Select a prompt from the list to edit',
    createTitle: 'Create New Prompt',
    internalKey: 'Internal Key',
    keyPlaceholder: 'e.g. DINDIN_V3_TEST',
    keyHint: 'Must be unique. Format: NAME_ENV',
    displayName: 'Display Name',
    namePlaceholder: 'e.g. DinDin Version 3 (Test)',
    environmentTag: 'Environment (Tag)',
    tagNone: 'None (Private)',
    tagProd: 'Production (PROD)',
    tagTest: 'Test / Sandbox (TEST)',
    initialContent: 'Initial Prompt',
    cancel: 'Cancel',
    creating: 'Creating...',
    create: 'Create',
    confirmActivate: 'Are you sure you want to',
    confirmRollback: 'Rollback to version',
    changelogRequired: 'Changelog is required',
    saved: 'Saved!',
    discardChanges: 'You have unsaved changes. Discard them?',
  }
}
const t = (key) => translations[lang.value]?.[key] || translations.en[key] || key

// ── State ────────────────────────────────────────────────────────
const prompts = ref([])
const loading = ref(false)
const saving = ref(false)
const activating = ref(false)
const creating = ref(false)
const rollingBack = ref(false)
const loadingPreview = ref(false)
const loadingHistory = ref(false)
const searchQuery = ref('')

const selectedPrompt = ref(null)
const editBuffer = ref('')
const changeLog = ref('')
const activeTab = ref('editor')

// Variables
const availableVariables = ref([])

// Preview
const renderedPreview = ref('')

// History
const versionHistory = ref([])

// Create Modal
const showCreateModal = ref(false)
const newItem = ref({ key: '', name: '', content: '', tag: '' })

// ── Tabs ──────────────────────────────────────────────────────────
const editorTabs = [
  { id: 'editor', labelKey: 'editor' },
  { id: 'preview', labelKey: 'preview' },
  { id: 'variables', labelKey: 'variables' },
  { id: 'history', labelKey: 'history' },
]

// ── Computed ──────────────────────────────────────────────────────
const hasChanges = computed(() => {
  if (!selectedPrompt.value) return false
  return editBuffer.value !== getCurrentContent(selectedPrompt.value)
})

const filteredPrompts = computed(() => {
  if (!searchQuery.value) return prompts.value
  const q = searchQuery.value.toLowerCase()
  return prompts.value.filter(p =>
    p.name?.toLowerCase().includes(q) ||
    p.key?.toLowerCase().includes(q) ||
    p.tags?.some(t => t.toLowerCase().includes(q))
  )
})

const variableCategories = computed(() => {
  const cats = new Set(availableVariables.value.map(v => v.category))
  return [...cats]
})

const renderedPreviewHtml = computed(() => {
  // Simple text to HTML — preserve newlines and whitespace
  if (!renderedPreview.value) return '<span class="text-muted">Click "Refresh Preview" to render</span>'
  return renderedPreview.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\{\{(\w+)\}\}/g, '<mark class="var-highlight">{{$1}}</mark>')
})

// ── Helpers ───────────────────────────────────────────────────────
const getCurrentContent = (prompt) => {
  if (!prompt || !prompt.versions) return ''
  const v = prompt.versions.find(ver => ver.version === prompt.activeVersion)
  return v ? v.content : (prompt.versions[0]?.content || '')
}

const variablesByCategory = (category) => {
  return availableVariables.value.filter(v => v.category === category)
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(lang.value === 'th' ? 'th-TH' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const insertVariable = (key) => {
  const textarea = document.getElementById('prompt-editor-textarea')
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const varText = `{{${key}}}`
  editBuffer.value = editBuffer.value.substring(0, start) + varText + editBuffer.value.substring(end)
  activeTab.value = 'editor'
  // Restore cursor position after Vue re-renders
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(start + varText.length, start + varText.length)
  }, 50)
}

// ── API ──────────────────────────────────────────────────────────
const fetchPrompts = async () => {
  loading.value = true
  try {
    const res = await api.get('/prompts?type=core')
    prompts.value = res.data.prompts || []
  } catch (e) {
    console.error('Failed to fetch prompts:', e)
  } finally {
    loading.value = false
  }
}

const fetchVariables = async () => {
  try {
    const res = await api.get('/prompts/meta/variables')
    availableVariables.value = res.data.variables || []
  } catch (e) {
    console.error('Failed to fetch variables:', e)
  }
}

const selectPrompt = async (prompt) => {
  if (hasChanges.value && !confirm(t('discardChanges'))) return

  const previous = selectedPrompt.value
  selectedPrompt.value = prompt

  try {
    const res = await api.get(`/prompts/${prompt.key}`)
    selectedPrompt.value = res.data.prompt
    editBuffer.value = getCurrentContent(selectedPrompt.value)
    changeLog.value = ''
    activeTab.value = 'editor'
    // Auto-load history
    loadVersionHistory()
  } catch (e) {
    alert('Failed to load prompt details')
    selectedPrompt.value = previous
  }
}

const saveVersion = async () => {
  if (!changeLog.value) return alert(t('changelogRequired'))
  saving.value = true
  try {
    await api.post(`/prompts/${selectedPrompt.value.key}/versions`, {
      content: editBuffer.value,
      changelog: changeLog.value
    })
    await selectPrompt(selectedPrompt.value)
    await fetchPrompts()
    alert(t('saved'))
  } catch (e) {
    alert('Save failed: ' + (e.response?.data?.error || e.message))
  } finally {
    saving.value = false
  }
}

const toggleActive = async () => {
  const isActivating = !selectedPrompt.value.isActive
  const action = isActivating ? t('setActive') : t('deactivate')
  if (!confirm(`${t('confirmActivate')} ${action}?`)) return

  activating.value = true
  try {
    await api.post(`/prompts/${selectedPrompt.value.key}/toggle-active`, { isActive: isActivating })
    selectedPrompt.value.isActive = isActivating
    await fetchPrompts()
  } catch (e) {
    alert(`${action} failed`)
  } finally {
    activating.value = false
  }
}

const loadPreview = async () => {
  if (!selectedPrompt.value) return
  loadingPreview.value = true
  try {
    const res = await api.post(`/prompts/${selectedPrompt.value.key}/preview`, {})
    renderedPreview.value = res.data.rendered || ''
  } catch (e) {
    renderedPreview.value = 'Preview failed: ' + (e.response?.data?.error || e.message)
  } finally {
    loadingPreview.value = false
  }
}

const loadVersionHistory = async () => {
  if (!selectedPrompt.value) return
  loadingHistory.value = true
  try {
    const res = await api.get(`/prompts/${selectedPrompt.value.key}/versions`)
    versionHistory.value = res.data.versions || []
  } catch (e) {
    console.error('Failed to load version history:', e)
  } finally {
    loadingHistory.value = false
  }
}

const rollbackTo = async (version) => {
  if (!confirm(`${t('confirmRollback')} ${version}?`)) return
  rollingBack.value = true
  try {
    await api.post(`/prompts/${selectedPrompt.value.key}/rollback`, { version })
    await selectPrompt(selectedPrompt.value)
    await fetchPrompts()
  } catch (e) {
    alert('Rollback failed: ' + (e.response?.data?.error || e.message))
  } finally {
    rollingBack.value = false
  }
}

const createPrompt = async () => {
  creating.value = true
  try {
    const payload = {
      ...newItem.value,
      type: 'core',
      tags: newItem.value.tag ? [newItem.value.tag] : []
    }
    await api.post('/prompts', payload)
    await fetchPrompts()
    closeCreateModal()
  } catch (e) {
    alert('Failed: ' + (e.response?.data?.error || e.message))
  } finally {
    creating.value = false
  }
}

const openCreateModal = () => {
  newItem.value = { key: '', name: '', content: '', tag: '' }
  showCreateModal.value = true
}
const closeCreateModal = () => { showCreateModal.value = false }

// Auto-load preview when switching to preview tab
watch(activeTab, (tab) => {
  if (tab === 'preview') loadPreview()
  if (tab === 'history') loadVersionHistory()
})

onMounted(() => {
  fetchPrompts()
  fetchVariables()
})
</script>

<style scoped>
.prompt-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: 'Inter', -apple-system, sans-serif;
}

/* Header */
.manager-header {
  height: 60px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 24px;
}
.header-content { width: 100%; display: flex; justify-content: space-between; align-items: center; }
.header-title { display: flex; align-items: center; gap: 12px; }
.header-title h1 { margin: 0; font-size: 18px; font-weight: 600; }
.badge-count {
  background: var(--color-bg-tertiary); color: var(--color-text-muted);
  font-size: 12px; padding: 2px 8px; border-radius: 99px; font-weight: 600;
}

/* Body */
.manager-body { flex: 1; display: flex; overflow: hidden; }

/* Sidebar */
.sidebar-list {
  width: 280px; border-right: 1px solid var(--color-border);
  background: var(--color-bg-secondary); display: flex; flex-direction: column; flex-shrink: 0;
}
.list-controls { padding: 12px; border-bottom: 1px solid var(--color-border); }
.search-input {
  width: 100%; background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
  padding: 8px 12px; border-radius: 6px; color: var(--color-text-primary); font-size: 13px;
}
.search-input:focus { outline: none; border-color: var(--color-accent); }
.list-scroll { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.empty-msg { padding: 16px; text-align: center; color: var(--color-text-muted); font-size: 13px; }

.list-item {
  text-align: left; background: transparent; border: 1px solid transparent;
  padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; outline: none;
}
.list-item:hover { background: var(--color-bg-hover); }
.list-item.selected { background: var(--color-bg-tertiary); border-color: var(--color-border); }
.item-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.item-name { font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 4px rgba(16,185,129,0.5); flex-shrink: 0; }
.item-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--color-text-secondary); }
.tag { background: rgba(59,130,246,0.1); color: #3b82f6; padding: 1px 4px; border-radius: 4px; margin-right: 4px; }
.version { font-family: monospace; }

/* Editor Pane */
.editor-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--color-bg-secondary); }
.editor-inner { display: flex; flex-direction: column; height: 100%; }
.editor-header {
  border-bottom: 1px solid var(--color-border); background: var(--color-bg-tertiary);
  display: flex; justify-content: space-between; align-items: center; padding: 8px 20px; flex-shrink: 0;
  flex-wrap: wrap; gap: 8px;
}
.editor-meta { display: flex; align-items: center; gap: 12px; }
.preview-title { margin: 0; font-size: 16px; font-weight: 600; }
.preview-key { font-size: 12px; color: var(--color-text-muted); background: rgba(0,0,0,0.15); padding: 2px 6px; border-radius: 4px; }
.badge-active { font-size: 10px; background: rgba(16,185,129,0.2); color: #34d399; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; font-weight: 700; }
.editor-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Tab Group */
.tab-group { display: flex; background: var(--color-bg-primary); border-radius: 6px; padding: 2px; gap: 2px; }
.tab-btn {
  background: transparent; border: none; color: var(--color-text-muted); font-size: 12px;
  padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-weight: 500;
}
.tab-btn:hover { color: var(--color-text-primary); }
.tab-btn.active { background: var(--color-accent); color: white; }

.divider-v { width: 1px; height: 16px; background: var(--color-border); }

/* Changelog */
.changelog-bar { padding: 8px 20px; background: var(--color-bg-tertiary); border-bottom: 1px solid var(--color-border); }
.changelog-input {
  width: 100%; border: 1px solid var(--color-border); background: var(--color-bg-primary); color: var(--color-text-primary);
  padding: 6px 10px; border-radius: 4px; font-size: 12px;
}
.changelog-input:focus { border-color: var(--color-accent); outline: none; }

/* Code Editor */
.code-wrapper { flex: 1; position: relative; overflow: hidden; }
.monaco-editor {
  width: 100%; height: 100%; background: var(--color-bg-primary); color: var(--color-text-primary);
  border: none; padding: 24px; font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px; line-height: 1.6; outline: none; resize: none;
}

/* Preview */
.preview-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.preview-toolbar { padding: 8px 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: flex-end; }
.preview-content {
  flex: 1; overflow-y: auto; padding: 24px; font-family: 'Consolas', monospace;
  font-size: 13px; line-height: 1.7; color: var(--color-text-secondary);
}
.preview-content :deep(.var-highlight) {
  background: rgba(59,130,246,0.2); color: #60a5fa; padding: 1px 4px; border-radius: 3px; font-weight: 600;
}

/* Variables */
.variables-wrapper { flex: 1; overflow-y: auto; padding: 20px; }
.var-category { margin-bottom: 20px; }
.var-category-title { font-size: 13px; text-transform: uppercase; color: var(--color-text-muted); font-weight: 600; margin: 0 0 8px 0; letter-spacing: 0.05em; }
.var-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.var-chip {
  display: flex; flex-direction: column; gap: 2px; background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 12px; cursor: pointer;
  transition: all 0.2s; min-width: 160px;
}
.var-chip:hover { border-color: var(--color-accent); background: rgba(59,130,246,0.05); }
.var-chip code { font-size: 12px; color: #60a5fa; font-weight: 600; }
.var-label { font-size: 11px; color: var(--color-text-secondary); }
.var-sample { font-size: 10px; color: var(--color-text-muted); font-style: italic; }

/* History */
.history-wrapper { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
.history-item {
  background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
  border-radius: 8px; padding: 12px; transition: all 0.2s;
}
.history-item.is-active { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.05); }
.history-main { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.history-version { font-weight: 600; font-size: 14px; font-family: monospace; }
.badge-active-sm { font-size: 9px; background: rgba(16,185,129,0.2); color: #34d399; padding: 1px 6px; border-radius: 99px; text-transform: uppercase; font-weight: 700; }
.history-date { font-size: 11px; color: var(--color-text-muted); margin-left: auto; }
.history-log { margin: 0; font-size: 12px; color: var(--color-text-secondary); }
.history-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.history-size { font-size: 11px; color: var(--color-text-muted); }

/* Empty State */
.empty-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; }
.placeholder-content { text-align: center; color: var(--color-text-muted); }

/* Buttons */
.btn-primary {
  background: var(--color-accent); color: white; border: none; padding: 8px 16px; border-radius: 6px;
  font-weight: 500; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn-xs { padding: 2px 8px; font-size: 11px; }
.btn-ghost { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-secondary); padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; }
.btn-ghost:hover { color: var(--color-text-primary); border-color: var(--color-text-muted); }
.btn-text { background: none; border: none; font-size: 13px; font-weight: 500; cursor: pointer; }
.text-success { color: #34d399; }
.text-danger { color: #f87171; }
.btn-close { background: none; border: none; font-size: 20px; color: var(--color-text-muted); cursor: pointer; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal-card { width: 440px; max-width: 90vw; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden; }
.modal-header { padding: 16px 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; background: var(--color-bg-tertiary); }
.modal-header h3 { margin: 0; font-size: 16px; }
.modal-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; }
.form-row label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--color-text-secondary); }
.input-std { width: 100%; background: var(--color-bg-primary); border: 1px solid var(--color-border); padding: 10px; border-radius: 6px; color: var(--color-text-primary); font-size: 13px; }
.input-std:focus { outline: none; border-color: var(--color-accent); }
.input-area { height: 100px; resize: none; font-family: monospace; }
.input-hint { font-size: 11px; color: var(--color-text-muted); margin-top: 4px; }
.modal-actions { padding: 16px 20px; background: var(--color-bg-tertiary); display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--color-border); }

/* Responsive */
@media (max-width: 768px) {
  .manager-body { flex-direction: column; overflow-y: auto; }
  .sidebar-list { width: 100%; height: 200px; border-right: none; border-bottom: 1px solid var(--color-border); }
  .editor-header { flex-direction: column; align-items: flex-start; }
}
</style>
