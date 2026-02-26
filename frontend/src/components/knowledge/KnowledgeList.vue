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

    <!-- Table (Desktop) -->
    <div class="table-container desktop-only">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('colName') }}</th>
            <th>{{ t('colType') }}</th>
            <th>{{ t('colDepartment') }}</th>
            <th>{{ t('colStatus') }}</th>
            <th>{{ t('colActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredKnowledge" :key="item._id" @click="$emit('open', item)" class="clickable-row">
            <td class="col-name">
              <div class="file-icon">📄</div>
              <div class="name-column">
                <!-- Folder Path -->
                <span v-if="item.folder" class="folder-path text-muted" style="font-size: 11px; margin-bottom: 2px;">📁 {{ item.folder }}</span>
                <span class="kb-title">
                  {{ item.title }}
                  <span v-if="item.version > 1" class="version-badge">v{{ item.version }}</span>
                </span>
                <div v-if="item.tags?.length" class="tag-chips-inline">
                  <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag-mini">{{ tag }}</span>
                  <span v-if="item.tags.length > 3" class="tag-more">+{{ item.tags.length - 3 }}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="badge" :class="getBadgeClass(item.type)">
                {{ item.type }}
              </span>
              <!-- Expiry Check -->
              <span v-if="item.expiresAt && new Date(item.expiresAt) < new Date()" class="status-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; margin-top: 4px; display: inline-block;">
                 ⚠️ Expired
              </span>
            </td>
            <td>{{ item.department }}</td>
            <td>
               <!-- Processing Status -->
               <div v-if="item.processingStatus && item.processingStatus !== 'completed' && item.processingStatus !== 'none'" 
                    class="status-badge" 
                    :class="getProcessingBadgeClass(item.processingStatus)">
                 {{ item.processingStatus === 'processing' ? t('processingStatus') : item.processingStatus }}
                 <span v-if="item.processingStatus === 'failed'" :title="item.errorReason">⚠️</span>
               </div>

               <!-- Publish Status -->
               <span v-else-if="item.requestStatus && item.requestStatus !== 'none'" class="status-badge" :class="getStatusBadge(item.requestStatus)">
                 {{ item.requestStatus }}
                 <span v-if="item.requestStatus === 'pending' && item.requestedType">
                    ({{ item.requestedType }})
                 </span>
               </span>
            </td>
            <td class="actions-cell">
               <!-- Request Publish (Owner Only) -->
               <div v-if="item.type === 'personal' && String(item.ownerId) === String(authStore.userId) && (!item.requestStatus || item.requestStatus === 'none' || item.requestStatus === 'rejected')" class="dropdown" @click.stop>
                  <button class="action-btn">{{ isAdmin ? t('directPublishBtn') : t('publishBtn') }}</button>
                  <div class="dropdown-content">
                     <a @click="handleRequestPublish(item._id, 'department')">{{ t('toDepartment') }}</a>
                     <a @click="handleRequestPublish(item._id, 'public')">{{ t('toPublic') }}</a>
                  </div>
               </div>

               <!-- Admin Approve/Reject -->
               <div v-if="(authStore.role === 'admin' || authStore.role === 'superadmin') && item.requestStatus === 'pending'" class="admin-actions">
                  <button class="btn-approve" @click.stop="handleApprove(item._id)">✓</button>
                  <button class="btn-reject" @click.stop="handleReject(item._id)">✗</button>
               </div>

               <!-- Delete -->
               <button v-if="canManage(item)" class="btn-icon delete" @click.stop="handleDelete(item._id)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
               </button>

               <!-- Retry (Failed only) -->
                <button v-if="item.processingStatus === 'failed'" class="btn-icon retry" @click.stop="handleRetry(item._id)" :title="t('retryProcessing')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
               </button>
            </td>
          </tr>
          <tr v-if="filteredKnowledge.length === 0">
             <td colspan="5" class="empty-row">{{ t('noKnowledgeFound') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards -->
    <div class="mobile-only">
        <div 
            v-for="item in filteredKnowledge" 
            :key="item._id" 
            class="knowledge-card"
            @click="$emit('open', item)"
        >
            <div class="card-header">
                <div class="card-title-group">
                   <!-- Folder Path -->
                   <div v-if="item.folder" class="folder-path text-muted" style="font-size: 11px; margin-bottom: 2px;">📁 {{ item.folder }}</div>
                   <div class="card-title">
                     <div class="file-icon">📄</div>
                     {{ item.title }}
                     <span v-if="item.version > 1" class="version-badge">v{{ item.version }}</span>
                   </div>
                </div>
                <button v-if="canManage(item)" class="btn-icon delete" @click.stop="handleDelete(item._id)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
               </button>
            </div>
            
            <div class="card-details">
                <span class="badge" :class="getBadgeClass(item.type)">{{ item.type }}</span>
                <span class="detail-label">{{ item.department }}</span>
            </div>

            <div class="card-details" v-if="(item.requestStatus && item.requestStatus !== 'none') || (item.expiresAt && new Date(item.expiresAt) < new Date())">
                 <span v-if="item.requestStatus && item.requestStatus !== 'none'" class="status-badge" :class="getStatusBadge(item.requestStatus)">
                     {{ item.requestStatus }}
                 </span>
                 <span v-if="item.expiresAt && new Date(item.expiresAt) < new Date()" class="status-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
                     ⚠️ Expired
                 </span>
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
}

.filter-btn:hover {
  background: var(--color-bg-hover);
}

.filter-btn.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.table-container {
  overflow-x: auto;
}

.mobile-only { display: none; }

@media (max-width: 768px) {
    .desktop-only { display: none; }
    .mobile-only { display: flex; flex-direction: column; gap: 12px; }
}

/* Card Styles */
.knowledge-card {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    position: relative;
    cursor: pointer;
}

.card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}

.card-title {
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
}

.card-details {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.detail-label, .kb-title {
  font-weight: 500;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-accent);
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.inline-tags {
    position: absolute;
    top: 16px;
    right: 16px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th, .data-table td {
  padding: 12px 16px;
  text-align: left;
  color: var(--color-text-primary);
  vertical-align: middle;
}

.data-table tr {
  border-bottom: 1px solid var(--color-border);
}

.data-table tbody tr:last-child {
  border-bottom: none;
}

.data-table th {
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: 13px;
}

.col-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.name-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.name-column span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-chips-inline {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag-mini {
  padding: 1px 6px;
  background: rgba(99, 102, 241, 0.08);
  color: var(--color-accent, #6366f1);
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
}

.tag-more {
  padding: 1px 4px;
  font-size: 10px;
  color: var(--color-text-muted);
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-personal { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.badge-dept { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.badge-public { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.badge-policy { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

.status-badge {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
}
.status-pending { color: #f59e0b; }
.status-approved { color: #10b981; }
.status-rejected { color: #ef4444; }
.status-processing { color: #3b82f6; display: inline-flex; align-items: center; gap: 4px; }
.status-failed { color: #ef4444; }

.actions-cell {
    display: flex;
    gap: 8px;
    align-items: center;
}

.btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 4px;
}
.btn-icon:hover { color: var(--color-text-primary); }
.btn-icon.delete:hover { color: #ef4444; }
.btn-icon.retry:hover { color: #3b82f6; }

.admin-actions {
    display: flex;
    gap: 4px;
}
.btn-approve { background: #10b981; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; }
.btn-reject { background: #ef4444; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; }

.dropdown {
  position: relative;
  display: inline-block;
}

.action-btn {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
}

.dropdown-content {
  display: none;
  position: absolute;
  background-color: var(--color-bg-card);
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.dropdown-content a {
  color: var(--color-text-primary);
  padding: 12px 16px;
  text-decoration: none;
  display: block;
  font-size: 12px;
  cursor: pointer;
}

.dropdown-content a:hover {background-color: var(--color-bg-hover);}

.dropdown:hover .dropdown-content {display: block;}

.empty-row {
    text-align: center;
    color: var(--color-text-muted);
    padding: 32px;
}

.clickable-row {
    cursor: pointer;
    transition: background 0.1s;
}
.clickable-row:hover {
    background: var(--color-bg-tertiary);
}
</style>