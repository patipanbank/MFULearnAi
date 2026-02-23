<script setup>
import { computed, ref } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import { useLanguage } from '@/composables/useSettings'

const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

const emit = defineEmits(['open'])

const filterType = ref('all') // 'all', 'personal', 'department', 'public', 'policy'
const searchQuery = ref('')

// Reusable "now" for expiry checks — avoids calling new Date() in every render
const now = computed(() => new Date())

const filteredKnowledge = computed(() => {
    let list = knowledgeStore.knowledge

    if (filterType.value !== 'all') {
        list = list.filter(k => k.type === filterType.value)
    }

    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
        list = list.filter(k => {
            const title  = (k.title       || '').toLowerCase()
            const desc   = (k.description || '').toLowerCase()
            const dept   = (k.department  || '').toLowerCase()
            const tags   = (k.tags        || []).join(' ').toLowerCase()
            const folder = (k.folder      || '').toLowerCase()
            return title.includes(q) || desc.includes(q) || dept.includes(q) || tags.includes(q) || folder.includes(q)
        })
    }

    return list
})

const isExpired = (item) => item.expiresAt && new Date(item.expiresAt) < now.value

const getBadgeClass = (type) => {
    const map = { public: 'badge-public', department: 'badge-dept', personal: 'badge-personal', policy: 'badge-policy' }
    return map[type] || 'badge-default'
}

const getStatusBadge = (status) => {
    const map = { approved: 'status-approved', rejected: 'status-rejected', pending: 'status-pending' }
    return map[status] || ''
}

const getProcessingBadgeClass = (status) => {
    const map = { processing: 'status-processing', pending: 'status-pending', failed: 'status-failed' }
    return map[status] || ''
}

const isProcessingStatus = (item) =>
    item.processingStatus && item.processingStatus !== 'completed' && item.processingStatus !== 'none'

const hasPublishStatus = (item) =>
    item.requestStatus && item.requestStatus !== 'none'

const canRequestPublish = (item) =>
    item.type === 'personal' && item.ownerId === authStore.userId && item.requestStatus === 'none'

const canPublishToPublic = computed(() =>
    authStore.role === 'admin' || authStore.role === 'superadmin'
)

const canAdminAction = (item) =>
    (authStore.role === 'admin' || authStore.role === 'superadmin') && item.requestStatus === 'pending'

const filterOptions = [
    { value: 'all',        label: t('filterAll')        || 'All'        },
    { value: 'personal',   label: t('filterPersonal')   || 'Personal'   },
    { value: 'department', label: t('filterDepartment') || 'Department' },
    { value: 'public',     label: t('filterPublic')     || 'Public'     },
    { value: 'policy',     label: t('filterPolicy')     || 'Policy'     },
]

// ─── Dropdown open state (click-based, touch-friendly) ───────────────────────
const openDropdownId = ref(null)
const toggleDropdown = (id, e) => {
    e.stopPropagation()
    openDropdownId.value = openDropdownId.value === id ? null : id
}
const closeDropdowns = () => { openDropdownId.value = null }

// ─── Actions ─────────────────────────────────────────────────────────────────
const handleRequestPublish = async (id, type, e) => {
    e.stopPropagation()
    closeDropdowns()
    if (confirm(`Request to publish this as ${type}?`)) {
        await knowledgeStore.requestPublish(id, type)
    }
}

const handleApprove = async (id, e) => {
    e.stopPropagation()
    await knowledgeStore.approvePublish(id, 'approve')
}

const handleReject = async (id, e) => {
    e.stopPropagation()
    await knowledgeStore.approvePublish(id, 'reject')
}

const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this item?')) {
        await knowledgeStore.deleteKnowledge(id)
    }
}

const handleRetry = async (id, e) => {
    e.stopPropagation()
    await knowledgeStore.retryKnowledge(id)
}
</script>

<template>
  <div class="knowledge-list" @click="closeDropdowns">
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
          placeholder="Search by name, tag, or description..."
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
            <th>Name</th>
            <th>Type</th>
            <th>Department</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in filteredKnowledge"
            :key="item._id"
            class="clickable-row"
            @click="$emit('open', item)"
          >
            <!-- Name -->
            <td class="col-name">
              <div class="file-icon">📄</div>
              <div class="name-column">
                <span v-if="item.folder" class="folder-path">📁 {{ item.folder }}</span>
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

            <!-- Type -->
            <td>
              <div class="cell-content">
                <span class="badge" :class="getBadgeClass(item.type)">{{ item.type }}</span>
                <span v-if="isExpired(item)" class="status-badge expired-badge">⚠️ Expired</span>
              </div>
            </td>

            <!-- Department -->
            <td>{{ item.department }}</td>

            <!-- Status -->
            <td>
              <div class="cell-content">
                <div
                  v-if="isProcessingStatus(item)"
                  class="status-badge"
                  :class="getProcessingBadgeClass(item.processingStatus)"
                >
                  {{ item.processingStatus === 'processing' ? 'Processing...' : item.processingStatus }}
                  <span v-if="item.processingStatus === 'failed'" :title="item.errorReason">⚠️</span>
                </div>
                <span v-else-if="hasPublishStatus(item)" class="status-badge" :class="getStatusBadge(item.requestStatus)">
                  {{ item.requestStatus }}
                  <span v-if="item.requestStatus === 'pending' && item.requestedType">({{ item.requestedType }})</span>
                </span>
              </div>
            </td>

            <!-- Actions -->
            <td class="actions-cell" @click.stop>
              <!-- Request Publish (Owner Only) — click-based dropdown -->
              <div v-if="canRequestPublish(item)" class="dropdown">
                <button class="action-btn" @click="toggleDropdown(item._id, $event)">
                  Publish ▾
                </button>
                <div class="dropdown-content" :class="{ open: openDropdownId === item._id }">
                  <a @click="handleRequestPublish(item._id, 'department', $event)">To Department</a>
                  <a
                    v-if="canPublishToPublic"
                    @click="handleRequestPublish(item._id, 'public', $event)"
                  >To Public</a>
                  <a v-else class="disabled">To Public (Admin Only)</a>
                </div>
              </div>

              <!-- Admin Approve/Reject -->
              <div v-if="canAdminAction(item)" class="admin-actions">
                <button class="btn-approve" @click="handleApprove(item._id, $event)" title="Approve">✓</button>
                <button class="btn-reject"  @click="handleReject(item._id, $event)"  title="Reject">✗</button>
              </div>

              <!-- Retry (Failed only) -->
              <button
                v-if="item.processingStatus === 'failed'"
                class="btn-icon retry"
                @click="handleRetry(item._id, $event)"
                title="Retry Processing"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>

              <!-- Delete -->
              <button class="btn-icon delete" @click="handleDelete(item._id, $event)" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </td>
          </tr>

          <tr v-if="filteredKnowledge.length === 0">
            <td colspan="5" class="empty-row">No knowledge found.</td>
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
            <div v-if="item.folder" class="folder-path">📁 {{ item.folder }}</div>
            <div class="card-title">
              <div class="file-icon">📄</div>
              {{ item.title }}
              <span v-if="item.version > 1" class="version-badge">v{{ item.version }}</span>
            </div>
          </div>
          <button class="btn-icon delete" @click.stop="handleDelete(item._id, $event)" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>

        <div class="card-details">
          <span class="badge" :class="getBadgeClass(item.type)">{{ item.type }}</span>
          <span class="detail-label">{{ item.department }}</span>
          <span v-if="isExpired(item)" class="status-badge expired-badge">⚠️ Expired</span>
        </div>

        <!-- Status row -->
        <div v-if="isProcessingStatus(item) || hasPublishStatus(item)" class="card-details">
          <div v-if="isProcessingStatus(item)" class="status-badge" :class="getProcessingBadgeClass(item.processingStatus)">
            {{ item.processingStatus === 'processing' ? 'Processing...' : item.processingStatus }}
          </div>
          <span v-else-if="hasPublishStatus(item)" class="status-badge" :class="getStatusBadge(item.requestStatus)">
            {{ item.requestStatus }}
          </span>
        </div>

        <!-- Mobile: Admin approve/reject -->
        <div v-if="canAdminAction(item)" class="card-mobile-actions" @click.stop>
          <button class="btn-mobile-approve" @click="handleApprove(item._id, $event)">✓ Approve</button>
          <button class="btn-mobile-reject"  @click="handleReject(item._id, $event)">✗ Reject</button>
        </div>

        <!-- Mobile: Retry -->
        <div v-if="item.processingStatus === 'failed'" class="card-mobile-actions" @click.stop>
          <button class="btn-mobile-retry" @click="handleRetry(item._id, $event)">↺ Retry Processing</button>
        </div>

        <!-- Mobile: Request Publish -->
        <div v-if="canRequestPublish(item)" class="card-mobile-actions" @click.stop>
          <button class="btn-mobile-publish" @click="handleRequestPublish(item._id, 'department', $event)">
            Publish to Department
          </button>
          <button v-if="canPublishToPublic" class="btn-mobile-publish" @click="handleRequestPublish(item._id, 'public', $event)">
            Publish to Public
          </button>
        </div>
      </div>

      <div v-if="filteredKnowledge.length === 0" class="empty-row">No knowledge found.</div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ─── Search + Filters ───────────────────────────────────────── */
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
}
.filter-btn:hover { background: var(--color-bg-hover); }
.filter-btn.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

/* ─── Table ──────────────────────────────────────────────────── */
.table-container { overflow-x: auto; }

.desktop-only { display: block; }
.mobile-only  { display: none; }

@media (max-width: 768px) {
  .desktop-only { display: none; }
  .mobile-only  { display: flex; flex-direction: column; gap: 12px; }
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  vertical-align: middle;
}

.data-table th {
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: 13px;
}

.clickable-row { cursor: pointer; transition: background 0.1s; }
.clickable-row:hover { background: var(--color-bg-tertiary); }

/* ─── Name Column ────────────────────────────────────────────── */
.col-name {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.file-icon { flex-shrink: 0; margin-top: 1px; }

.name-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.folder-path {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kb-title {
  font-weight: 500;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.version-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-accent);
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.tag-chips-inline { display: flex; gap: 4px; flex-wrap: wrap; }

.tag-mini {
  padding: 1px 6px;
  background: rgba(99, 102, 241, 0.08);
  color: var(--color-accent, #6366f1);
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
}

.tag-more { padding: 1px 4px; font-size: 10px; color: var(--color-text-muted); }

/* ─── Cell Content Wrapper ───────────────────────────────────── */
.cell-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

/* ─── Badges ─────────────────────────────────────────────────── */
.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge-personal  { background: rgba(59, 130, 246, 0.1);  color: #3b82f6; }
.badge-dept      { background: rgba(16, 185, 129, 0.1);  color: #10b981; }
.badge-public    { background: rgba(245, 158, 11, 0.1);  color: #f59e0b; }
.badge-policy    { background: rgba(139, 92, 246, 0.1);  color: #8b5cf6; }

.status-badge {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.expired-badge   { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.status-pending  { color: #f59e0b; }
.status-approved { color: #10b981; }
.status-rejected { color: #ef4444; }
.status-processing { color: #3b82f6; display: inline-flex; align-items: center; gap: 4px; }
.status-failed   { color: #ef4444; }

/* ─── Actions Cell ───────────────────────────────────────────── */
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
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.btn-icon:hover         { color: var(--color-text-primary); background: var(--color-bg-hover); }
.btn-icon.delete:hover  { color: #ef4444; }
.btn-icon.retry:hover   { color: #3b82f6; }

.admin-actions { display: flex; gap: 4px; }

.btn-approve {
  background: #10b981; color: white; border: none;
  border-radius: 4px; width: 26px; height: 26px; cursor: pointer;
  font-size: 13px; transition: background 0.15s;
}
.btn-approve:hover { background: #059669; }

.btn-reject {
  background: #ef4444; color: white; border: none;
  border-radius: 4px; width: 26px; height: 26px; cursor: pointer;
  font-size: 13px; transition: background 0.15s;
}
.btn-reject:hover { background: #dc2626; }

/* ─── Publish Dropdown (click-based) ─────────────────────────── */
.dropdown { position: relative; display: inline-block; }

.action-btn {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.action-btn:hover { background: var(--color-bg-hover); }

.dropdown-content {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--color-bg-card);
  min-width: 160px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 20;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}
.dropdown-content.open { display: block; }

.dropdown-content a {
  color: var(--color-text-primary);
  padding: 10px 16px;
  text-decoration: none;
  display: block;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}
.dropdown-content a:hover { background: var(--color-bg-hover); }
.dropdown-content a.disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
  pointer-events: none;
}

/* ─── Empty ──────────────────────────────────────────────────── */
.empty-row {
  text-align: center;
  color: var(--color-text-muted);
  padding: 32px;
}

/* ─── Mobile Cards ───────────────────────────────────────────── */
.knowledge-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: background 0.1s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.knowledge-card:hover { background: var(--color-bg-hover); }

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.card-title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title {
  font-weight: 600;
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
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.detail-label { font-weight: 500; color: var(--color-text-primary); }

/* Mobile action buttons */
.card-mobile-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-mobile-approve,
.btn-mobile-reject,
.btn-mobile-retry,
.btn-mobile-publish {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-mobile-approve  { background: #10b981; color: white; }
.btn-mobile-reject   { background: #ef4444; color: white; }
.btn-mobile-retry    { background: #3b82f6; color: white; }
.btn-mobile-publish  { background: var(--color-bg-card); color: var(--color-text-primary); border: 1px solid var(--color-border); }

.btn-mobile-approve:hover { opacity: 0.85; }
.btn-mobile-reject:hover  { opacity: 0.85; }
.btn-mobile-retry:hover   { opacity: 0.85; }
.btn-mobile-publish:hover { background: var(--color-bg-hover); }
</style>