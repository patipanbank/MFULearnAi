<script setup>
import { ref, onMounted } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['close'])

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
  <div class="modal-overlay" @click="$emit('close')">
    <div class="admin-modal" @click.stop>
      <div class="modal-header">
          <h3>Manage Publish Requests</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
          <div class="toolbar">
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
                          <span>Owner: {{ item.ownerId }}</span>
                          <span>•</span>
                          <span>Dept: {{ item.department }}</span>
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
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.admin-modal {
  background: var(--color-bg-card);
  padding: 0;
  border-radius: 12px;
  width: 600px;
  max-width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 { margin: 0; font-size: 18px; }

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-text-muted);
}

.modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
}

.toolbar {
    margin-bottom: 16px;
    text-align: right;
}

.btn-refresh {
    background: transparent;
    border: 1px solid var(--color-border);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: 12px;
}
.btn-refresh:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }

.empty-state, .loading {
    text-align: center;
    padding: 40px;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    border-radius: 8px;
}

.requests-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.request-card {
    display: flex;
    align-items: center;
    background: var(--color-bg-tertiary);
    padding: 12px 16px;
    border-radius: 8px;
    justify-content: space-between;
}

.card-left { flex: 1; }

.item-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 2px;
}

.item-meta {
    font-size: 11px;
    color: var(--color-text-muted);
}

.card-center {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 16px;
    color: var(--color-text-muted);
}

.target-type {
    background: var(--color-accent);
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
}

.card-actions {
    display: flex;
    gap: 8px;
}

.btn-approve, .btn-reject {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
}

.btn-approve { background: #10b981; }
.btn-reject { background: #ef4444; }
.btn-approve:hover, .btn-reject:hover { opacity: 0.9; }

</style>
