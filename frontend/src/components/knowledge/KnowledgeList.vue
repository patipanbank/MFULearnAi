<script setup>
import { computed, ref } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import { useLanguage } from '@/composables/useSettings'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

const { confirm: showConfirm, alert: showAlert } = useConfirmDialog()

const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

const isAdmin = computed(() => authStore.role === 'admin' || authStore.role === 'superadmin')

// Permission helper: determine if user can manage (edit/delete) a knowledge item
const canManage = (item) => {
    if (authStore.role === 'superadmin') return true
    if (item.type === 'personal') return item.ownerId === authStore.userId
    if (item.type === 'department') return authStore.role === 'admin' && authStore.department === item.department
    if (item.type === 'public') return authStore.role === 'admin' && authStore.department === item.department
    if (item.type === 'policy') return authStore.role === 'admin'
    return false
}

const emit = defineEmits(['open'])

const filterType = ref('all') // 'all', 'personal', 'department', 'public'
const searchQuery = ref('')

const filteredKnowledge = computed(() => {
    let list = knowledgeStore.knowledge

    // Type filter
    if (filterType.value !== 'all') {
        list = list.filter(k => k.type === filterType.value)
    }

    // Search filter (title, description, tags, department, folder)
    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
        list = list.filter(k => {
            const title = (k.title || '').toLowerCase()
            const desc = (k.description || '').toLowerCase()
            const dept = (k.department || '').toLowerCase()
            const tags = (k.tags || []).join(' ').toLowerCase()
            const folder = (k.folder || '').toLowerCase()
            return title.includes(q) || desc.includes(q) || dept.includes(q) || tags.includes(q) || folder.includes(q)
        })
    }

    return list
})

const getBadgeClass = (type) => {
    switch (type) {
        case 'public': return 'badge-public'
        case 'department': return 'badge-dept'
        case 'personal': return 'badge-personal'
        case 'policy': return 'badge-policy'
        default: return 'badge-default'
    }
}

const getStatusBadge = (status) => {
    switch (status) {
        case 'approved': return 'status-approved'
        case 'rejected': return 'status-rejected'
        case 'pending': return 'status-pending'
        default: return ''
    }
}

const getProcessingBadgeClass = (status) => {
    switch (status) {
        case 'processing': return 'status-processing'
        case 'pending': return 'status-pending'
        case 'failed': return 'status-failed'
        default: return ''
    }
}

// Translations for filters (can be moved to useSettings)
const filterOptions = computed(() => [
    { value: 'all', label: t('filterAll') },
    { value: 'personal', label: t('filterPersonal') },
    { value: 'department', label: t('filterDepartment') },
    { value: 'public', label: t('filterPublic') },
    { value: 'policy', label: t('filterPolicy') }
])

const handleRequestPublish = async (id, type) => {
    const confirmMsg = isAdmin.value
        ? t('confirmDirectPublish').replace('{type}', type)
        : t('confirmPublishRequest').replace('{type}', type)
    if (await showConfirm(confirmMsg, { variant: 'info', title: t('publishRequestTitle') })) {
        try {
            await knowledgeStore.requestPublish(id, type)
            await showAlert(
                isAdmin.value ? t('publishSuccess') : t('publishRequestSent'),
                { variant: 'success', title: t('publishRequestTitle') }
            )
        } catch (e) {
            await showAlert(
                e.response?.data?.error || e.message || t('publishFailed'),
                { variant: 'error', title: t('publishRequestTitle') }
            )
        }
    }
}

const handleApprove = async (id) => {
    try {
        await knowledgeStore.approvePublish(id, 'approve')
    } catch (e) {
        await showAlert(
            e.response?.data?.error || e.message || 'Approve failed',
            { variant: 'error' }
        )
    }
}

const handleReject = async (id) => {
    try {
        await knowledgeStore.approvePublish(id, 'reject')
    } catch (e) {
        await showAlert(
            e.response?.data?.error || e.message || 'Reject failed',
            { variant: 'error' }
        )
    }
}

const handleDelete = async (id) => {
    if (await showConfirm(t('confirmDeleteKnowledge'), { variant: 'danger' })) {
        await knowledgeStore.deleteKnowledge(id)
    }
}

const handleRetry = async (id) => {
    await knowledgeStore.retryKnowledge(id)
}

// ── Inline Rename ──
const renamingId = ref(null)
const renameValue = ref('')
const renameInput = ref(null)

const startRename = (item, event) => {
    event.stopPropagation()
    renamingId.value = item._id
    renameValue.value = item.title
    // focus after DOM update
    setTimeout(() => renameInput.value?.focus(), 50)
}

const commitRename = async (id) => {
    const newTitle = renameValue.value.trim()
    if (!newTitle) { cancelRename(); return }
    try {
        await knowledgeStore.updateKnowledge(id, { title: newTitle })
    } catch (e) {
        await showAlert(e.response?.data?.error || e.message || 'Rename failed', { variant: 'error' })
    } finally {
        renamingId.value = null
    }
}

const cancelRename = () => { renamingId.value = null }
</script>

<template>
  <div class="knowledge-list">
    <!-- Search + Filters -->
    <div class="search-filters">
      <div class="search-bar">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="t('searchKnowledge')"
        />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">×</button>
      </div>
      <div class="filters">
        <button 
          v-for="opt in filterOptions" 
          :key="opt.value"
          class="filter-btn"
          :class="{ active: filterType === opt.value }"
          @click="filterType = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Knowledge Rows (unified responsive) -->
    <div class="kb-list">
      <!-- Header row -->
      <div class="kb-row kb-row--header" aria-hidden="true">
        <div class="kb-col kb-col--name">{{ t('colName') }}</div>
        <div class="kb-col kb-col--type">{{ t('colType') }}</div>
        <div class="kb-col kb-col--dept">{{ t('colDepartment') }}</div>
        <div class="kb-col kb-col--status">{{ t('colStatus') }}</div>
        <div class="kb-col kb-col--actions">{{ t('colActions') }}</div>
      </div>

      <!-- Data rows -->
      <div
        v-for="item in filteredKnowledge"
        :key="item._id"
        class="kb-row"
        @click="$emit('open', item)"
      >
        <!-- Name -->
        <div class="kb-col kb-col--name">
          <span class="file-icon">📄</span>
          <div class="name-stack">
            <span v-if="item.folder" class="folder-crumb">📁 {{ item.folder }}</span>
            <template v-if="renamingId === item._id">
              <div class="rename-inline" @click.stop>
                <input
                  ref="renameInput"
                  v-model="renameValue"
                  class="rename-input"
                  maxlength="200"
                  @keyup.enter="commitRename(item._id)"
                  @keyup.esc="cancelRename"
                />
                <button class="rename-save" @click.stop="commitRename(item._id)" title="Save">✓</button>
                <button class="rename-cancel" @click.stop="cancelRename" title="Cancel">✕</button>
              </div>
            </template>
            <template v-else>
              <span class="kb-title">
                {{ item.title }}
                <span v-if="item.version > 1" class="version-badge">v{{ item.version }}</span>
              </span>
            </template>
            <div v-if="item.tags?.length" class="tag-chips-inline">
              <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag-mini">{{ tag }}</span>
              <span v-if="item.tags.length > 3" class="tag-more">+{{ item.tags.length - 3 }}</span>
            </div>
          </div>
        </div>

        <!-- Type + expiry -->
        <div class="kb-col kb-col--type">
          <span class="badge" :class="getBadgeClass(item.type)">{{ item.type }}</span>
          <span v-if="item.expiresAt && new Date(item.expiresAt) < new Date()" class="status-badge status-expired">⚠️ Expired</span>
        </div>

        <!-- Department -->
        <div class="kb-col kb-col--dept">{{ item.department }}</div>

        <!-- Processing / Publish status -->
        <div class="kb-col kb-col--status">
          <div
            v-if="item.processingStatus && item.processingStatus !== 'completed' && item.processingStatus !== 'none'"
            class="status-badge"
            :class="getProcessingBadgeClass(item.processingStatus)"
          >
            {{ item.processingStatus === 'processing' ? t('processingStatus') : item.processingStatus }}
            <span v-if="item.processingStatus === 'failed'" :title="item.errorReason">⚠️</span>
          </div>
          <span
            v-else-if="item.requestStatus && item.requestStatus !== 'none'"
            class="status-badge"
            :class="getStatusBadge(item.requestStatus)"
          >
            {{ item.requestStatus }}
            <span v-if="item.requestStatus === 'pending' && item.requestedType">({{ item.requestedType }})</span>
          </span>
        </div>

        <!-- Actions -->
        <div class="kb-col kb-col--actions" @click.stop>
          <!-- Publish dropdown (owner only) -->
          <div
            v-if="item.type === 'personal' && String(item.ownerId) === String(authStore.userId) && (!item.requestStatus || item.requestStatus === 'none' || item.requestStatus === 'rejected')"
            class="dropdown"
          >
            <button class="action-btn">{{ isAdmin ? t('directPublishBtn') : t('publishBtn') }}</button>
            <div class="dropdown-content">
              <a @click="handleRequestPublish(item._id, 'department')">{{ t('toDepartment') }}</a>
              <a @click="handleRequestPublish(item._id, 'public')">{{ t('toPublic') }}</a>
            </div>
          </div>

          <!-- Admin Approve/Reject -->
          <div v-if="(authStore.role === 'admin' || authStore.role === 'superadmin') && item.requestStatus === 'pending'" class="admin-actions">
            <button class="btn-approve" @click.stop="handleApprove(item._id)" title="Approve">✓</button>
            <button class="btn-reject"  @click.stop="handleReject(item._id)"  title="Reject">✗</button>
          </div>

          <!-- Rename -->
          <button v-if="canManage(item)" class="btn-icon rename" @click.stop="startRename(item, $event)" :title="t('renameKnowledge')">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>

          <!-- Delete -->
          <button v-if="canManage(item)" class="btn-icon delete" @click.stop="handleDelete(item._id)" :title="t('delete')">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>

          <!-- Retry (failed only) -->
          <button v-if="item.processingStatus === 'failed'" class="btn-icon retry" @click.stop="handleRetry(item._id)" :title="t('retryProcessing')">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </div>
      </div>

      <div v-if="filteredKnowledge.length === 0" class="empty-row">
        {{ t('noKnowledgeFound') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px 14px;
  transition: border-color 0.15s;
}
.search-bar:focus-within {
  border-color: var(--color-accent, #6366f1);
}

.search-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--color-text-primary);
  font-size: 14px;
}
.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-clear {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
}
.search-clear:hover { color: var(--color-text-primary); }

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.filter-btn:hover { background: var(--color-bg-hover); }
.filter-btn.active { background: var(--color-accent); color: white; border-color: var(--color-accent); }

/* ── Shared badge / status tokens ── */
.badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}
.badge-personal { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; }
.badge-dept     { background: rgba(59, 130, 246, 0.12);  color: #3b82f6; }
.badge-public   { background: rgba(16, 185, 129, 0.12);  color: #10b981; }
.badge-policy   { background: rgba(245, 158, 11, 0.12);  color: #f59e0b; }

.status-badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
.status-pending    { background: rgba(245, 158, 11, 0.12);  color: #f59e0b; }
.status-approved   { background: rgba(16, 185, 129, 0.12);  color: #10b981; }
.status-rejected   { background: rgba(239, 68, 68, 0.12);   color: #ef4444; }
.status-expired    { background: rgba(239, 68, 68, 0.12);   color: #ef4444; }
.status-processing { background: rgba(59, 130, 246, 0.12);  color: #3b82f6; }
.status-failed     { background: rgba(239, 68, 68, 0.12);   color: #ef4444; }

.version-badge {
  font-size: 10px; font-weight: 700;
  color: var(--color-accent);
  background: rgba(99, 102, 241, 0.1);
  padding: 1px 5px; border-radius: 4px;
  flex-shrink: 0;
}

.tag-chips-inline { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.tag-mini {
  padding: 1px 5px;
  background: rgba(99, 102, 241, 0.08);
  color: var(--color-accent, #6366f1);
  border-radius: 10px; font-size: 10px; font-weight: 500;
}
.tag-more { padding: 1px 4px; font-size: 10px; color: var(--color-text-muted); }

/* ── kb-list: unified responsive rows ── */
.kb-list {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

/* Grid: name | type | dept | status | actions */
.kb-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 100px 110px 130px auto;
  grid-template-areas: "name type dept status actions";
  column-gap: 12px;
  padding: 11px 16px;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.12s;
}
.kb-row:last-child { border-bottom: none; }
.kb-row:hover { background: var(--color-bg-tertiary); }

/* Header row */
.kb-row--header {
  cursor: default;
  background: var(--color-bg-tertiary);
  font-size: 11px; font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.6px;
  padding: 8px 16px;
}
.kb-row--header:hover { background: var(--color-bg-tertiary); }

.kb-col--name    { grid-area: name;    display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.kb-col--type    { grid-area: type;    display: flex; flex-direction: column; gap: 4px; }
.kb-col--dept    { grid-area: dept;    font-size: 13px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-col--status  { grid-area: status;  display: flex; flex-direction: column; gap: 4px; }
.kb-col--actions { grid-area: actions; display: flex; gap: 5px; align-items: center; justify-content: flex-end; }

/* Tablet ≤ 900px: hide dept column */
@media (max-width: 900px) {
  .kb-row {
    grid-template-columns: minmax(0, 1fr) 100px 130px auto;
    grid-template-areas: "name type status actions";
  }
  .kb-col--dept { display: none; }
}

/* Mobile ≤ 600px: 2-col, name/actions on row 1, type+status below */
@media (max-width: 600px) {
  .kb-row {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "name    actions"
      "type    type"
      "status  status";
    row-gap: 6px;
    padding: 12px 14px;
  }
  .kb-row--header { display: none; }
  .kb-col--dept   { display: none; }
  .kb-col--type   { flex-direction: row; flex-wrap: wrap; }
  .kb-col--actions { align-self: start; }
}

/* Name internals */
.file-icon { font-size: 18px; flex-shrink: 0; line-height: 1; margin-top: 2px; }

.name-stack {
  display: flex; flex-direction: column; gap: 3px;
  min-width: 0; flex: 1;
}
.folder-crumb {
  font-size: 11px; color: var(--color-text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.kb-title {
  font-weight: 500; font-size: 14px;
  color: var(--color-text-primary);
  display: flex; align-items: center; gap: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Empty state */
.empty-row {
  padding: 40px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 14px;
}

/* ── Action buttons ── */
.btn-icon {
  background: none; border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 5px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.btn-icon:hover               { color: var(--color-text-primary); background: var(--color-bg-hover); }
.btn-icon.delete:hover        { color: #ef4444; background: rgba(239,68,68,0.08); }
.btn-icon.retry:hover         { color: #3b82f6; background: rgba(59,130,246,0.08); }
.btn-icon.rename:hover        { color: var(--color-accent, #6366f1); background: rgba(99,102,241,0.08); }

.admin-actions { display: flex; gap: 4px; }
.btn-approve { background: #10b981; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-size: 12px; }
.btn-reject  { background: #ef4444; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-size: 12px; }
.btn-approve:hover { background: #059669; }
.btn-reject:hover  { background: #dc2626; }

.dropdown { position: relative; display: inline-block; }
.action-btn {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  padding: 4px 8px; font-size: 12px; border-radius: 4px; cursor: pointer;
  white-space: nowrap;
}
.dropdown-content {
  display: none; position: absolute; right: 0;
  background: var(--color-bg-card); min-width: 150px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 10; border: 1px solid var(--color-border); border-radius: 8px;
  overflow: hidden;
}
.dropdown-content a {
  color: var(--color-text-primary);
  padding: 10px 14px; text-decoration: none;
  display: block; font-size: 13px; cursor: pointer;
}
.dropdown-content a:hover { background: var(--color-bg-hover); }
.dropdown:hover .dropdown-content { display: block; }

/* ── Inline Rename ── */
.rename-inline {
  display: flex; align-items: center; gap: 4px; width: 100%;
}
.rename-input {
  flex: 1; padding: 3px 7px; font-size: 13px;
  border: 1px solid var(--color-accent, #3b82f6);
  border-radius: 4px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  outline: none; min-width: 0;
}
.rename-save,
.rename-cancel {
  flex-shrink: 0; width: 24px; height: 24px; border: none;
  border-radius: 4px; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; padding: 0;
}
.rename-save   { background: #22c55e; color: #fff; }
.rename-save:hover { background: #16a34a; }
.rename-cancel { background: var(--color-bg-tertiary); color: var(--color-text-muted); }
.rename-cancel:hover { background: var(--color-bg-hover); }
</style>