<script setup>
import { computed, ref } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import { useLanguage } from '@/composables/useSettings'

const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

const emit = defineEmits(['open'])

const filterType = ref('all') // 'all', 'personal', 'department', 'public'

const filteredKnowledge = computed(() => {
    if (filterType.value === 'all') return knowledgeStore.knowledge
    return knowledgeStore.knowledge.filter(k => k.type === filterType.value)
})

const getBadgeClass = (type) => {
    switch (type) {
        case 'public': return 'badge-public'
        case 'department': return 'badge-dept'
        case 'personal': return 'badge-personal'
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
const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'personal', label: 'Personal' },
    { value: 'department', label: 'Department' },
    { value: 'public', label: 'Public' }
]

const handleRequestPublish = async (id, type) => {
    if (confirm(`Request to publish this as ${type}?`)) {
        await knowledgeStore.requestPublish(id, type)
    }
}

const handleApprove = async (id) => {
    await knowledgeStore.approvePublish(id, 'approve')
}

const handleReject = async (id) => {
    await knowledgeStore.approvePublish(id, 'reject')
}

const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this item?')) {
        await knowledgeStore.deleteKnowledge(id)
    }
}
</script>

<template>
  <div class="knowledge-list">
    <!-- Filters -->
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
          <tr v-for="item in filteredKnowledge" :key="item._id" @click="$emit('open', item)" class="clickable-row">
            <td class="col-name">
              <div class="file-icon">📄</div>
              <span>{{ item.title }}</span>
            </td>
            <td>
              <span class="badge" :class="getBadgeClass(item.type)">
                {{ item.type }}
              </span>
            </td>
            <td>{{ item.department }}</td>
            <td>
               <!-- Processing Status -->
               <div v-if="item.processingStatus && item.processingStatus !== 'completed' && item.processingStatus !== 'none'" 
                    class="status-badge" 
                    :class="getProcessingBadgeClass(item.processingStatus)">
                 {{ item.processingStatus === 'processing' ? 'Processing...' : item.processingStatus }}
                 <span v-if="item.processingStatus === 'failed'" :title="item.errorReason">⚠️</span>
               </div>

               <!-- Publish Status -->
               <span v-else-if="item.requestStatus !== 'none'" class="status-badge" :class="getStatusBadge(item.requestStatus)">
                 {{ item.requestStatus }}
                 <span v-if="item.requestStatus === 'pending' && item.requestedType">
                    ({{ item.requestedType }})
                 </span>
               </span>
            </td>
            <td class="actions-cell">
               <!-- Request Publish (Owner Only) -->
               <div v-if="item.type === 'personal' && item.ownerId === authStore.userId && item.requestStatus === 'none'" class="dropdown">
                  <button class="action-btn">Publish</button>
                  <div class="dropdown-content">
                     <a @click="handleRequestPublish(item._id, 'department')">To Department</a>
                     <a href="#" class="disabled">To Public (Admin Only)</a> 
                  </div>
               </div>

               <!-- Admin Approve/Reject -->
               <div v-if="authStore.role === 'admin' && item.requestStatus === 'pending'" class="admin-actions">
                  <button class="btn-approve" @click="handleApprove(item._id)">✓</button>
                  <button class="btn-reject" @click="handleReject(item._id)">✗</button>
               </div>

               <!-- Delete -->
               <button class="btn-icon delete" @click="handleDelete(item._id)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
                <div class="file-icon">📄</div>
                <div class="card-title">{{ item.title }}</div>
                <button class="btn-icon delete" @click.stop="handleDelete(item._id)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
               </button>
            </div>
            
            <div class="card-details">
                <span class="badge" :class="getBadgeClass(item.type)">{{ item.type }}</span>
                <span class="detail-label">{{ item.department }}</span>
            </div>

            <div class="card-details" v-if="item.requestStatus !== 'none'">
                 <span class="status-badge" :class="getStatusBadge(item.requestStatus)">
                     {{ item.requestStatus }}
                 </span>
            </div>
        </div>
        
        <div v-if="filteredKnowledge.length === 0" class="empty-row">
             No knowledge found.
        </div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

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
}

.card-details {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.detail-label {
    font-weight: 500;
    color: var(--color-text-muted);
}

.card-actions {
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
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
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
