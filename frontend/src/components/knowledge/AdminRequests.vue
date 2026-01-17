<script setup>
import { ref, onMounted } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'

const knowledgeStore = useKnowledgeStore()
const authStore = useAuthStore()

const requests = ref([])
const loading = ref(false)

const fetchRequests = async () => {
    loading.value = true
    try {
        requests.value = await knowledgeStore.fetchPendingRequests()
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    fetchRequests()
})

const handleApprove = async (id) => {
    if(!confirm('Approve this request?')) return
    await knowledgeStore.approvePublish(id, 'approve')
    await fetchRequests()
}

const handleReject = async (id) => {
    if(!confirm('Reject this request?')) return
    await knowledgeStore.approvePublish(id, 'reject')
    await fetchRequests()
}

</script>

<template>
  <div class="admin-requests">
      <div class="header">
          <h3>Pending Requests</h3>
          <button class="btn-refresh" @click="fetchRequests">↻ Refresh</button>
      </div>

      <div v-if="loading" class="loading">Loading requests...</div>
      
      <div v-else-if="requests.length === 0" class="empty-state">
          No pending requests found.
      </div>

      <div v-else class="requests-list">
          <div v-for="item in requests" :key="item._id" class="request-card">
              <div class="card-left">
                  <div class="item-title">{{ item.title }}</div>
                  <div class="item-meta">
                      <span>Owner: {{ item.ownerId }}</span> <!-- Ideally resolve name -->
                      <span>•</span>
                      <span>Department: {{ item.department }}</span>
                  </div>
              </div>
              
              <div class="card-center">
                  <div class="arrow">→</div>
                  <div class="target-type">{{ item.requestedType }}</div>
              </div>

              <div class="card-actions">
                  <button class="btn-approve" @click="handleApprove(item._id)">Approve</button>
                  <button class="btn-reject" @click="handleReject(item._id)">Reject</button>
              </div>
          </div>
      </div>
  </div>
</template>

<style scoped>
.admin-requests {
    padding: 24px;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

h3 { margin: 0; color: var(--color-text-primary); }

.btn-refresh {
    background: transparent;
    border: 1px solid var(--color-border);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-muted);
}
.btn-refresh:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }

.empty-state, .loading {
    text-align: center;
    padding: 40px;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    border-radius: 12px;
}

.requests-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.request-card {
    display: flex;
    align-items: center;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    padding: 16px;
    border-radius: 12px;
    justify-content: space-between;
}

.card-left {
    flex: 1;
}

.item-title {
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 4px;
}

.item-meta {
    font-size: 12px;
    color: var(--color-text-muted);
}

.card-center {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 24px;
    color: var(--color-text-muted);
}

.target-type {
    background: var(--color-accent);
    color: white;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
}

.card-actions {
    display: flex;
    gap: 8px;
}

.btn-approve, .btn-reject {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
}

.btn-approve { background: #10b981; }
.btn-reject { background: #ef4444; }
.btn-approve:hover, .btn-reject:hover { opacity: 0.9; }

</style>
