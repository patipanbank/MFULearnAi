<script setup>
import { computed, ref } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import { useLanguage } from '@/composables/useSettings'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

// Detect file type from title/filename for richer icons
const getFileIcon = (item) => {
  const name = (item.title || item.filename || '').toLowerCase()
  if (name.endsWith('.pdf'))                        return 'pdf'
  if (name.match(/\.(docx?|odt)$/))                return 'word'
  if (name.match(/\.(xlsx?|csv|ods)$/))             return 'excel'
  if (name.match(/\.(pptx?|odp)$/))                return 'ppt'
  if (name.match(/\.(png|jpe?g|gif|webp|svg)$/))   return 'image'
  if (name.match(/\.(mp4|mov|avi|mkv|webm)$/))     return 'video'
  if (name.match(/\.(mp3|wav|ogg|flac)$/))         return 'audio'
  if (name.match(/\.(zip|rar|7z|tar\.gz)$/))       return 'archive'
  if (name.match(/\.(md|txt)$/))                   return 'text'
  if (name.match(/\.(js|ts|py|java|go|rb|php)$/)) return 'code'
  return 'doc'
}

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
const searchFocused = ref(false)

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
      <div class="search-bar" :class="{ focused: searchFocused }">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="t('searchKnowledge')"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
        <transition name="fade-quick">
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''" aria-label="Clear search">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </transition>
        <span v-if="searchQuery && filteredKnowledge.length > 0" class="search-count">{{ filteredKnowledge.length }}</span>
      </div>
      <div class="filters">
        <button
          v-for="opt in filterOptions"
          :key="opt.value"
          class="filter-btn"
          :class="{ active: filterType === opt.value }"
          @click="filterType = opt.value"
        >
          <span v-if="opt.value === 'all'" class="filter-dot all"></span>
          <span v-else-if="opt.value === 'personal'" class="filter-dot personal"></span>
          <span v-else-if="opt.value === 'department'" class="filter-dot dept"></span>
          <span v-else-if="opt.value === 'public'" class="filter-dot public"></span>
          <span v-else-if="opt.value === 'policy'" class="filter-dot policy"></span>
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Knowledge Rows -->
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
      <transition-group name="list-item">
        <div
          v-for="item in filteredKnowledge"
          :key="item._id"
          class="kb-row"
          @click="$emit('open', item)"
        >
          <!-- Name -->
          <div class="kb-col kb-col--name">
            <!-- File type icon -->
            <div class="file-icon-wrap" :class="'icon-' + getFileIcon(item)">
              <!-- PDF -->
              <svg v-if="getFileIcon(item) === 'pdf'" class="ftype-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="9" y2="17"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="15" y1="14" x2="15" y2="17"/></svg>
              <!-- Word -->
              <svg v-else-if="getFileIcon(item) === 'word'" class="ftype-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <!-- Excel -->
              <svg v-else-if="getFileIcon(item) === 'excel'" class="ftype-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/><line x1="12" y1="10" x2="12" y2="18"/></svg>
              <!-- Image -->
              <svg v-else-if="getFileIcon(item) === 'image'" class="ftype-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <!-- Code -->
              <svg v-else-if="getFileIcon(item) === 'code'" class="ftype-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <!-- Default doc -->
              <svg v-else class="ftype-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>

            <div class="name-stack">
              <span v-if="item.folder" class="folder-crumb">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                {{ item.folder }}
              </span>
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
                  <button class="rename-save" @click.stop="commitRename(item._id)" title="Save">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button class="rename-cancel" @click.stop="cancelRename" title="Cancel">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </template>
              <template v-else>
                <span class="kb-title">
                  {{ item.title }}
                  <span v-if="item.version > 1" class="version-badge">v{{ item.version }}</span>
                </span>
              </template>
              <div v-if="item.tags?.length" class="tag-chips-inline">
                <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag-mini">#{{ tag }}</span>
                <span v-if="item.tags.length > 3" class="tag-more">+{{ item.tags.length - 3 }}</span>
              </div>
            </div>
          </div>

          <!-- Type + expiry -->
          <div class="kb-col kb-col--type">
            <span class="badge" :class="getBadgeClass(item.type)">{{ item.type }}</span>
            <span v-if="item.expiresAt && new Date(item.expiresAt) < new Date()" class="status-badge status-expired">Expired</span>
          </div>

          <!-- Department -->
          <div class="kb-col kb-col--dept" :title="item.department || ''">
            <span v-if="item.department" class="dept-text">{{ item.department }}</span>
            <span v-else class="dept-empty">—</span>
          </div>

          <!-- Processing / Publish status -->
          <div class="kb-col kb-col--status">
            <div
              v-if="item.processingStatus && item.processingStatus !== 'completed' && item.processingStatus !== 'none'"
              class="status-badge"
              :class="getProcessingBadgeClass(item.processingStatus)"
            >
              <span v-if="item.processingStatus === 'processing'" class="status-spinner"></span>
              {{ item.processingStatus === 'processing' ? t('processingStatus') : item.processingStatus }}
              <span v-if="item.processingStatus === 'failed'" class="fail-hint" :title="item.errorReason">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </span>
            </div>
            <span
              v-else-if="item.requestStatus && item.requestStatus !== 'none'"
              class="status-badge"
              :class="getStatusBadge(item.requestStatus)"
            >
              {{ item.requestStatus }}
              <span v-if="item.requestStatus === 'pending' && item.requestedType" class="req-type">({{ item.requestedType }})</span>
            </span>
            <!-- no active badge = ready, show nothing -->
          </div>

          <!-- Actions -->
          <div class="kb-col kb-col--actions" @click.stop>
            <!-- Publish dropdown (owner only) -->
            <div
              v-if="item.type === 'personal' && String(item.ownerId) === String(authStore.userId) && (!item.requestStatus || item.requestStatus === 'none' || item.requestStatus === 'rejected')"
              class="dropdown"
            >
              <button class="action-btn" :title="isAdmin ? t('directPublishBtn') : t('publishBtn')">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><path d="M5 21h14"/></svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="dropdown-content">
                <a @click="handleRequestPublish(item._id, 'department')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {{ t('toDepartment') }}
                </a>
                <a @click="handleRequestPublish(item._id, 'public')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  {{ t('toPublic') }}
                </a>
              </div>
            </div>

            <!-- Admin Approve/Reject -->
            <div v-if="(authStore.role === 'admin' || authStore.role === 'superadmin') && item.requestStatus === 'pending'" class="admin-actions">
              <button class="btn-approve" @click.stop="handleApprove(item._id)" title="Approve">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button class="btn-reject"  @click.stop="handleReject(item._id)"  title="Reject">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <!-- Retry (failed only) -->
            <button v-if="item.processingStatus === 'failed'" class="btn-icon retry" @click.stop="handleRetry(item._id)" :title="t('retryProcessing')">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>

            <!-- Rename -->
            <button v-if="canManage(item)" class="btn-icon rename" @click.stop="startRename(item, $event)" :title="t('renameKnowledge')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>

            <!-- Delete -->
            <button v-if="canManage(item)" class="btn-icon delete" @click.stop="handleDelete(item._id)" :title="t('delete')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </transition-group>

      <!-- Empty state -->
      <div v-if="filteredKnowledge.length === 0" class="empty-state">
        <div class="empty-illus">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="80" height="80" rx="40" fill="currentColor" fill-opacity="0.05"/>
            <path d="M25 55V28a2 2 0 0 1 2-2h17l11 11v18a2 2 0 0 1-2 2H27a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M44 26v11h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="31" y1="40" x2="49" y2="40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="31" y1="46" x2="42" y2="46" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="empty-title">{{ searchQuery ? t('noKnowledgeFound') : t('noKnowledgeFound') }}</p>
        <p v-if="searchQuery" class="empty-sub">Try a different search term or filter</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Root ── */
.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Search + Filters ── */
.search-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-secondary);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 9px 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-bar.focused {
  border-color: var(--color-accent, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.search-icon { color: var(--color-text-muted); flex-shrink: 0; }

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--color-text-primary);
  font-size: 14px;
}
.search-input::placeholder { color: var(--color-text-muted); }

.search-clear {
  background: var(--color-bg-tertiary);
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  width: 22px; height: 22px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.search-clear:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }

.search-count {
  font-size: 11px; font-weight: 600;
  color: var(--color-accent, #6366f1);
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 7px; border-radius: 20px;
  flex-shrink: 0;
}

/* Fade quick transition for clear button */
.fade-quick-enter-active,
.fade-quick-leave-active { transition: opacity 0.15s; }
.fade-quick-enter-from,
.fade-quick-leave-to { opacity: 0; }

/* ── Filter pills ── */
.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 13px;
  border-radius: 20px;
  border: 1.5px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;
}
.filter-btn:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }
.filter-btn.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

/* Color dots in filter buttons */
.filter-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.filter-dot.all        { background: var(--color-text-muted); }
.filter-dot.personal   { background: #8b5cf6; }
.filter-dot.dept       { background: #3b82f6; }
.filter-dot.public     { background: #10b981; }
.filter-dot.policy     { background: #f59e0b; }

/* ── kb-list: SINGLE grid spanning all rows ── */
/*
  Architecture: .kb-list is the grid container.
  .kb-row uses display:contents so each cell participates
  in the SAME grid tracks → true column alignment regardless
  of content width differences per row.
  Column budget (desktop ≥901px):
    name    → 1fr   (flexible)
    name    → flexible (takes remaining space, min 0)
    type    → min 80px,  grow 1fr
    dept    → min 100px, grow 1fr
    status  → min 90px,  grow 1fr
    actions → min 130px, grow 1.5fr  (always enough for 3 icon btns + publish)
    Using minmax ensures columns never collapse below content while remaining proportional.
*/
.kb-list {
  display: grid;
  grid-template-columns: minmax(0, 4fr) minmax(80px, 1fr) minmax(100px, 1fr) minmax(90px, 1fr) minmax(130px, 3fr);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.kb-row {
  display: contents;
}

/* Every direct cell gets common padding + border-bottom */
.kb-row > .kb-col {
  padding: 12px 8px;
  border-bottom: 1px solid var(--color-border);
  align-self: stretch;   /* stretch to row height → borders align perfectly */
  display: flex;
  align-items: center;   /* content stays vertically centered inside */
  min-width: 0;
  background: transparent;
  transition: background 0.12s;
}
.kb-row > .kb-col:first-child { padding-left: 16px; }
.kb-row > .kb-col:last-child  { padding-right: 16px; }

/* Hover: highlight all cells in hovered row via :has() */
.kb-list:has(.kb-row > .kb-col:not(.kb-col--header):hover)
  .kb-row:has(> .kb-col:hover) > .kb-col {
  background: var(--color-bg-hover, rgba(99, 102, 241, 0.03));
}

/* Accent left border on hover — on the name cell */
.kb-row:not(.kb-row--header) > .kb-col--name:hover,
.kb-row:not(.kb-row--header):has(> .kb-col:hover) > .kb-col--name {
  box-shadow: inset 3px 0 0 var(--color-accent, #6366f1);
}

/* Remove bottom border on last data row */
.kb-row:last-child > .kb-col { border-bottom: none; }

/* Pointer cursor on data rows */
.kb-row:not(.kb-row--header) > .kb-col { cursor: pointer; }
.kb-row:not(.kb-row--header) > .kb-col--actions { cursor: default; }

/* ── Header row ── */
.kb-row--header > .kb-col {
  background: var(--color-bg-tertiary) !important;
  cursor: default !important;
  box-shadow: none !important;
  font-size: 10.5px; font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.7px;
  padding-top: 9px; padding-bottom: 9px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kb-col--name    { display: flex; align-items: center; gap: 10px; }
.kb-col--type    { display: flex; flex-direction: column; gap: 4px; }
.kb-col--dept    { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-col--status  { display: flex; align-items: center; gap: 4px; }
.kb-col--actions { display: flex; gap: 3px; align-items: center; justify-content: flex-end; flex-wrap: nowrap; overflow: hidden; }

/* Tablet 769-900px: hide dept */
@media (max-width: 900px) and (min-width: 769px) {
  .kb-list {
    grid-template-columns: minmax(0, 4fr) minmax(80px, 1fr) minmax(90px, 1fr) minmax(130px, 1.5fr);
  }
  .kb-col--dept { display: none; }
}

/* Mobile ≤ 768px: switch to card layout — avoids cramped 4-column grid */
@media (max-width: 768px) {
  .kb-list {
    display: block; /* exit grid mode */
  }

  .kb-row--header { display: none; }

  /* Each data row becomes a card with 3-column grid */
  .kb-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-areas:
      "name    name    name"
      "type    status  actions";
    row-gap: 8px;
    column-gap: 8px;
    padding: 14px;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    transition: background 0.12s;
    background: transparent;
  }
  .kb-row:last-child { border-bottom: none; }
  .kb-row:hover { background: var(--color-bg-hover, rgba(99,102,241,0.03)); }

  /* Reset cell styles set by container-grid rules */
  .kb-row > .kb-col {
    padding: 0;
    border-bottom: none;
    background: transparent;
    cursor: inherit;
    box-shadow: none;
  }
  .kb-row > .kb-col:first-child { padding-left: 0; }
  .kb-row > .kb-col:last-child  { padding-right: 0; }

  .kb-col--name    { grid-area: name;    align-items: flex-start; }
  .kb-col--type    { grid-area: type;    flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px; }
  .kb-col--dept    { display: none; }
  .kb-col--status  { grid-area: status;  flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; }
  .kb-col--actions {
    grid-area: actions;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px;
    overflow: visible;
  }
}

/* ── File icon ── */
.file-icon-wrap {
  width: 34px; height: 34px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  margin-top: 1px;
}
.file-icon-wrap.icon-pdf     { background: rgba(239, 68, 68, 0.08);   color: #ef4444; }
.file-icon-wrap.icon-word    { background: rgba(59, 130, 246, 0.08);  color: #3b82f6; }
.file-icon-wrap.icon-excel   { background: rgba(16, 185, 129, 0.08);  color: #10b981; }
.file-icon-wrap.icon-ppt     { background: rgba(245, 158, 11, 0.08);  color: #f59e0b; }
.file-icon-wrap.icon-image   { background: rgba(168, 85, 247, 0.08);  color: #a855f7; }
.file-icon-wrap.icon-video   { background: rgba(239, 68, 68, 0.08);   color: #ef4444; }
.file-icon-wrap.icon-audio   { background: rgba(236, 72, 153, 0.08);  color: #ec4899; }
.file-icon-wrap.icon-archive { background: rgba(245, 158, 11, 0.08);  color: #f59e0b; }
.file-icon-wrap.icon-text    { background: rgba(107, 114, 128, 0.08); color: #6b7280; }
.file-icon-wrap.icon-code    { background: rgba(20, 184, 166, 0.08);  color: #14b8a6; }

.ftype-svg { width: 16px; height: 16px; }

/* ── Name stack ── */
.name-stack {
  display: flex; flex-direction: column; gap: 3px;
  min-width: 0; flex: 1;
}

.folder-crumb {
  display: flex; align-items: center; gap: 3px;
  font-size: 11px; color: var(--color-text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.kb-title {
  font-weight: 500; font-size: 14px;
  color: var(--color-text-primary);
  display: flex; align-items: center; gap: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.version-badge {
  font-size: 10px; font-weight: 700;
  color: var(--color-accent, #6366f1);
  background: rgba(99, 102, 241, 0.1);
  padding: 1px 5px; border-radius: 4px;
  flex-shrink: 0;
}

/* ── Tags ── */
.tag-chips-inline { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.tag-mini {
  padding: 1px 6px;
  background: rgba(99, 102, 241, 0.07);
  color: var(--color-accent, #6366f1);
  border-radius: 10px;
  font-size: 10px; font-weight: 500;
  border: 1px solid rgba(99, 102, 241, 0.15);
}
.tag-more { padding: 1px 4px; font-size: 10px; color: var(--color-text-muted); }

/* ── Dept ── */
.dept-text {
  font-size: 13px; color: var(--color-text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: block;
}
.dept-empty { color: var(--color-text-muted); font-size: 13px; }

/* ── Badges ── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
  width: fit-content;
}
.badge-personal { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.2); }
.badge-dept     { background: rgba(59, 130, 246, 0.1);  color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
.badge-public   { background: rgba(16, 185, 129, 0.1);  color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
.badge-policy   { background: rgba(245, 158, 11, 0.1);  color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }

/* ── Status badges ── */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 20px;
  white-space: nowrap;
  width: fit-content;
}
.status-pending    { background: rgba(245, 158, 11, 0.1);  color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
.status-approved   { background: rgba(16, 185, 129, 0.1);  color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
.status-rejected   { background: rgba(239, 68, 68, 0.1);   color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.status-expired    { background: rgba(239, 68, 68, 0.1);   color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.status-processing { background: rgba(59, 130, 246, 0.1);  color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
.status-failed     { background: rgba(239, 68, 68, 0.1);   color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }

/* Processing spinner inside badge */
.status-spinner {
  width: 10px; height: 10px;
  border: 1.5px solid rgba(59, 130, 246, 0.3);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.fail-hint { display: flex; align-items: center; cursor: help; }
.req-type  { opacity: 0.7; font-size: 10px; }

/* ── List item transition ── */
.list-item-enter-active { transition: all 0.25s ease; }
.list-item-leave-active { transition: all 0.18s ease; }
.list-item-enter-from   { opacity: 0; transform: translateY(-6px); }
.list-item-leave-to     { opacity: 0; }

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
  gap: 10px;
  color: var(--color-text-muted);
}
.empty-illus {
  width: 80px; height: 80px;
  color: var(--color-text-muted);
  opacity: 0.5;
  margin-bottom: 4px;
}
.empty-title {
  font-size: 15px; font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}
.empty-sub {
  font-size: 13px; color: var(--color-text-muted);
  margin: 0;
}

/* ── Action buttons ── */
.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 4px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.btn-icon:hover               { color: var(--color-text-primary); background: var(--color-bg-hover); }
.btn-icon.delete:hover        { color: #ef4444; background: rgba(239, 68, 68, 0.08); }
.btn-icon.retry:hover         { color: #3b82f6; background: rgba(59, 130, 246, 0.08); }
.btn-icon.rename:hover        { color: var(--color-accent, #6366f1); background: rgba(99, 102, 241, 0.08); }

.admin-actions { display: flex; gap: 4px; }
.btn-approve {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 7px;
  width: 28px; height: 28px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.btn-approve:hover { background: #10b981; color: white; }
.btn-reject {
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 7px;
  width: 28px; height: 28px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.btn-reject:hover { background: #ef4444; color: white; }

/* ── Publish dropdown ── */
.dropdown { position: relative; display: inline-flex; flex-shrink: 0; }
/* Publish trigger: compact icon-only button */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1.5px solid var(--color-border);
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 1;
  min-width: 0;
  transition: all 0.15s;
}
.action-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }

.dropdown-content {
  display: none;
  position: absolute;
  right: 0; top: calc(100% + 6px);
  background: var(--color-bg-card);
  min-width: 170px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  z-index: 20;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  animation: dropdownIn 0.15s ease;
}
@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.dropdown-content a {
  color: var(--color-text-primary);
  padding: 10px 14px;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
}
.dropdown-content a:hover { background: var(--color-bg-hover); }
.dropdown:hover .dropdown-content { display: block; }

/* ── Inline Rename ── */
.rename-inline {
  display: flex; align-items: center; gap: 5px; width: 100%;
}
.rename-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 13px;
  border: 1.5px solid var(--color-accent, #3b82f6);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  outline: none;
  min-width: 0;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
}
.rename-save,
.rename-cancel {
  flex-shrink: 0;
  width: 26px; height: 26px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
  transition: all 0.15s;
}
.rename-save   { background: #22c55e; color: #fff; }
.rename-save:hover { background: #16a34a; }
.rename-cancel { background: var(--color-bg-tertiary); color: var(--color-text-muted); }
.rename-cancel:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }
</style>