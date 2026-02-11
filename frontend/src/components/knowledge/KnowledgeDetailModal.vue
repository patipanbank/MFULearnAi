<script setup>
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useKnowledgeStore } from '@/stores/knowledge'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()

const isOwner = computed(() => props.item.ownerId === authStore.userId)

const handleRequestPublish = async (targetType) => {
    if (!confirm(`Request to publish this item to ${targetType}?`)) return
    
    try {
        await knowledgeStore.requestPublish(props.item._id, targetType)
        emit('success')
        emit('close')
    } catch (e) {
        alert(e.message)
    }
}

const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString()
}

const showReadMode = ref(false)
const toggleReadMode = () => showReadMode.value = !showReadMode.value
</script>

<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-card" @click.stop>
      <div class="modal-header">
        <h3>Knowledge Details</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <div class="detail-group">
            <label>Title</label>
            <div class="value title">{{ item.title }}</div>
        </div>

        <div class="detail-row">
            <div class="detail-group">
                <label>Type</label>
                <div class="value">
                    <span class="badge" :class="item.type">{{ item.type }}</span>
                </div>
            </div>
            <div class="detail-group">
                <label>Department</label>
                <div class="value">{{ item.department }}</div>
            </div>
        </div>

        <div class="detail-group">
            <label>Description</label>
            <div class="value desc">{{ item.description || 'No description provided.' }}</div>
        </div>

        <div class="detail-row">
            <div class="detail-group">
                <label>File Source</label>
                <div class="value file">{{ item.contentSource }}</div>
            </div>
            <div class="detail-group">
                <label>Created At</label>
                <div class="value">{{ formatDate(item.createdAt) }}</div>
            </div>
        </div>

        <div class="detail-group">
            <div class="content-header">
                <label>Content Preview</label>
                <button v-if="item.content" class="btn-icon" @click="toggleReadMode" title="Read Full Content">
                    ⤢ Expand
                </button>
            </div>
            
            <div class="content-box">
                <pre v-if="item.content">{{ item.content }}</pre>
                <div v-else class="no-content">
                    <p>No content available.</p>
                    <small>Files uploaded before the latest update do not have readable content stored.</small>
                </div>
            </div>
        </div>

        <!-- Full Screen Read Modal -->
        <div v-if="showReadMode && item.content" class="read-mode-overlay" @click="toggleReadMode">
            <div class="read-mode-content" @click.stop>
                <div class="read-header">
                    <h3>{{ item.title }}</h3>
                    <button class="close-btn" @click="toggleReadMode">×</button>
                </div>
                <div class="read-body">
                    <pre>{{ item.content }}</pre>
                </div>
            </div>
        </div>

        <!-- Publish Status Section -->
        <div class="status-section" v-if="item.requestStatus !== 'none'">
            <h4>Publish Status</h4>
            <div class="status-box" :class="item.requestStatus">
                <span class="status-label">Status: <strong>{{ item.requestStatus }}</strong></span>
                <span v-if="item.requestedType" class="target-label">Target: {{ item.requestedType }}</span>
            </div>
        </div>

        <!-- Actions -->
        <div class="actions-section" v-if="isOwner && item.type === 'personal'">
            <h4>Actions</h4>
            <div class="btn-group">
                <button 
                    v-if="item.requestStatus === 'none' || item.requestStatus === 'rejected'"
                    class="btn-action" 
                    @click="handleRequestPublish('department')"
                >
                    Request Publish to Department
                </button>
                <!-- Public request is usually restricted or requires department upgrade first -->
                 <!-- <button class="btn-action" @click="handleRequestPublish('public')">Request Publish to Public</button> -->
            </div>
            <p v-if="item.requestStatus === 'pending'" class="pending-msg">
                Your request to publish is pending approval.
            </p>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* Uses global .modal-overlay from main.css */

.modal-card {
  background: var(--color-bg-card);
  padding: 24px;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-text-muted);
}
.close-btn:hover { color: var(--color-text-primary); }

.detail-group {
    margin-bottom: 16px;
}

.detail-row {
    display: flex;
    gap: 24px;
}
.detail-row .detail-group { flex: 1; }

label {
    display: block;
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 4px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.value {
    font-size: 14px;
    color: var(--color-text-primary);
}

.value.title {
    font-size: 18px;
    font-weight: 600;
}

.value.desc {
    color: var(--color-text-secondary);
    line-height: 1.5;
    background: var(--color-bg-tertiary);
    padding: 12px;
    border-radius: 8px;
}

.value.file {
    font-family: monospace;
    background: var(--color-bg-tertiary);
    padding: 4px 8px;
    border-radius: 4px;
    display: inline-block;
}

.badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
}
.badge.personal { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.badge.department { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.badge.public { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

.status-section {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
}

.status-box {
    display: flex;
    justify-content: space-between;
    padding: 12px;
    border-radius: 8px;
    background: var(--color-bg-tertiary);
    font-size: 14px;
}

.status-box.pending { border-left: 4px solid #f59e0b; }
.status-box.approved { border-left: 4px solid #10b981; }
.status-box.rejected { border-left: 4px solid #ef4444; }

.actions-section {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
}

h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.btn-action {
    width: 100%;
    padding: 10px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
}

.btn-action:hover {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
}

.pending-msg {
    color: #f59e0b;
    font-size: 13px;
    margin-top: 8px;
    text-align: center;
}

.content-box {
    background: var(--color-bg-tertiary);
    border-radius: 8px;
    padding: 12px;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
}

.content-box pre {
    white-space: pre-wrap;
    font-family: inherit;
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0;
}

.no-content {
    color: var(--color-text-muted);
    font-style: italic;
    font-size: 13px;
    text-align: center;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.btn-icon {
    background: none;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
}
.btn-icon:hover { text-decoration: underline; }

/* Read Mode Overlay */
.read-mode-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.read-mode-content {
    background: var(--color-bg-card);
    width: 800px;
    max-width: 95%;
    height: 90vh;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.read-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.read-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    background: var(--color-bg-tertiary);
}

.read-body pre {
    white-space: pre-wrap;
    font-family: 'Inter', sans-serif; /* More readable than mono */
    font-size: 16px;
    line-height: 1.6;
    color: var(--color-text-primary);
    max-width: 100%;
}
</style>
