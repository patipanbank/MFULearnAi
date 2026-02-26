<script setup>
import { computed, ref, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'
import { useModalKeyboard } from '@/composables/useModalKeyboard'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'success', 'update'])

const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

// ── Keyboard support ──
const modalRef = ref(null)
useModalKeyboard({
  onClose: () => emit('close'),
  modalRef,
})

const isOwner = computed(() => String(props.item.ownerId) === String(authStore.userId))
const isAdmin = computed(() => authStore.role === 'admin' || authStore.role === 'superadmin')
const canEdit = computed(() => isOwner.value || isAdmin.value)

// Editing state
const editingDesc = ref(false)
const editDesc = ref('')
const savingDesc = ref(false)
const descSaved = ref(false)

// Tags state
const editingTags = ref(false)
const newTag = ref('')
const localTags = ref([...(props.item.tags || [])])
const savingTags = ref(false)
const tagsSaved = ref(false)

const startEditDesc = () => {
    editDesc.value = props.item.description || ''
    editingDesc.value = true
}

const saveDesc = async () => {
    if (savingDesc.value) return
    savingDesc.value = true
    try {
        await knowledgeStore.updateKnowledge(props.item._id, { description: editDesc.value })
        emit('update', { description: editDesc.value })
        editingDesc.value = false
        descSaved.value = true
        setTimeout(() => descSaved.value = false, 2000)
    } catch (e) {
        console.error('Save description failed', e)
    } finally {
        savingDesc.value = false
    }
}

const cancelEditDesc = () => {
    editingDesc.value = false
}

// Folder state
const editingFolder = ref(false)
const editFolder = ref('')
const savingFolder = ref(false)
const folderSaved = ref(false)

const startEditFolder = () => {
    editFolder.value = props.item.folder || ''
    editingFolder.value = true
}

const saveFolder = async () => {
    if (savingFolder.value) return
    savingFolder.value = true
    try {
        await knowledgeStore.updateKnowledge(props.item._id, { folder: editFolder.value })
        emit('update', { folder: editFolder.value })
        editingFolder.value = false
        folderSaved.value = true
        setTimeout(() => folderSaved.value = false, 2000)
    } catch (e) {
        console.error('Save folder failed', e)
    } finally {
        savingFolder.value = false
    }
}

const cancelEditFolder = () => {
    editingFolder.value = false
}

// ExpiresAt state
const editingExpires = ref(false)
const editExpires = ref('')
const savingExpires = ref(false)
const expiresSaved = ref(false)

const startEditExpires = () => {
    editExpires.value = props.item.expiresAt ? props.item.expiresAt.split('T')[0] : ''
    editingExpires.value = true
}

const saveExpires = async () => {
    if (savingExpires.value) return
    savingExpires.value = true
    try {
        const payload = editExpires.value ? { expiresAt: new Date(editExpires.value).toISOString() } : { expiresAt: null }
        await knowledgeStore.updateKnowledge(props.item._id, payload)
        emit('update', { expiresAt: payload.expiresAt })
        editingExpires.value = false
        expiresSaved.value = true
        setTimeout(() => expiresSaved.value = false, 2000)
    } catch (e) {
        console.error('Save expiry failed', e)
    } finally {
        savingExpires.value = false
    }
}

const cancelEditExpires = () => {
    editingExpires.value = false
}

const addTag = async () => {
    const tag = newTag.value.trim().toLowerCase()
    if (!tag || localTags.value.includes(tag)) {
        newTag.value = ''
        return
    }
    if (localTags.value.length >= 20) return
    localTags.value.push(tag)
    newTag.value = ''
    await saveTagsToServer()
}

const removeTag = async (tag) => {
    localTags.value = localTags.value.filter(t => t !== tag)
    await saveTagsToServer()
}

const saveTagsToServer = async () => {
    savingTags.value = true
    try {
        await knowledgeStore.updateKnowledge(props.item._id, { tags: localTags.value })
        emit('update', { tags: [...localTags.value] })
        tagsSaved.value = true
        setTimeout(() => tagsSaved.value = false, 2000)
    } catch (e) {
        console.error('Save tags failed', e)
    } finally {
        savingTags.value = false
    }
}

// Inline confirm for publish request
const showPublishConfirm = ref(false)
const publishing = ref(false)
const publishTargetType = ref('department') // 'department' | 'public'

const publishConfirmRef = ref(null)

const askPublishConfirm = () => {
    showPublishConfirm.value = true
    nextTick(() => {
        publishConfirmRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
}

const cancelPublish = () => {
    showPublishConfirm.value = false
}

const handleRequestPublish = async () => {
    publishing.value = true
    showPublishConfirm.value = false

    try {
        await knowledgeStore.requestPublish(props.item._id, publishTargetType.value)
        emit('success')
        emit('close')
    } catch (e) {
        publishError.value = e.response?.data?.error || e.message || 'Failed to request publish'
    } finally {
        publishing.value = false
    }
}

const publishError = ref('')

const formatDate = (dateString) => {
    if (!dateString) return '-'
    const d = new Date(dateString)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const showReadMode = ref(false)
const toggleReadMode = () => showReadMode.value = !showReadMode.value

// Status color mapping
const getStatusColor = (status) => {
    switch (status) {
        case 'pending': return '#f59e0b'
        case 'approved': return '#10b981'
        case 'rejected': return '#ef4444'
        default: return 'var(--color-text-muted)'
    }
}

// Tab state
const activeTab = ref('details') // 'details' | 'analytics'

// Analytics state
const analytics = ref(null)
const analyticsLoading = ref(false)
const analyticsError = ref('')

const switchTab = async (tab) => {
    activeTab.value = tab
    if (tab === 'analytics' && !analytics.value) {
        await loadAnalytics()
    }
}

const loadAnalytics = async () => {
    analyticsLoading.value = true
    analyticsError.value = ''
    try {
        analytics.value = await knowledgeStore.fetchDocumentAnalytics(props.item._id)
    } catch (e) {
        analyticsError.value = e.response?.data?.error || 'Failed to load analytics'
    } finally {
        analyticsLoading.value = false
    }
}

// Bar chart helper: compute max height for relative bars
const maxDailyHit = computed(() => {
    if (!analytics.value?.dailyHits?.length) return 1
    return Math.max(...analytics.value.dailyHits.map(d => d.count), 1)
})
const getQualityClass = (score) => {
    if (!score) return 'quality-unknown'
    if (score >= 80) return 'quality-high'
    if (score >= 50) return 'quality-medium'
    return 'quality-low'
}
</script>

<template>
  <Transition name="modal-fade">
    <div class="modal-overlay" @click="$emit('close')">
      <div ref="modalRef" class="knowledge-modal" @click.stop role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-title-area">
            <div class="header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <h3>{{ t('knowledgeDetails') }}</h3>
          </div>
          <button class="close-btn" @click="$emit('close')" :aria-label="t('cancel')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="modal-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'details' }"
            @click="switchTab('details')"
          >Details</button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'analytics' }"
            @click="switchTab('analytics')"
          >Analytics</button>
        </div>

        <!-- Body -->
        <div class="modal-body">

          <!-- Details Tab -->
          <template v-if="activeTab === 'details'">
          <!-- Title -->
          <div class="detail-group">
            <label>{{ t('knowledgeDetailTitle') }}</label>
            <div class="value title">
              {{ item.title }}
              <span v-if="item.version > 1" class="version-badge">v{{ item.version }}</span>
            </div>
          </div>

          <!-- Type + Department -->
          <div class="detail-row">
            <div class="detail-group">
              <label>{{ t('knowledgeDetailType') }}</label>
              <div class="value">
                <span class="badge" :class="item.type">{{ item.type }}</span>
              </div>
            </div>
            <div class="detail-group">
              <label>{{ t('knowledgeDetailDept') }}</label>
              <div class="value">{{ item.department }}</div>
            </div>
          </div>

          <!-- Description (editable) -->
          <div class="detail-group">
            <div class="content-header">
              <label>{{ t('knowledgeDetailDesc') }}</label>
              <button v-if="canEdit && !editingDesc" class="btn-edit" @click="startEditDesc">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
              <span v-if="descSaved" class="save-indicator">✓ Saved</span>
            </div>
            <div v-if="editingDesc" class="edit-area">
              <textarea
                v-model="editDesc"
                class="edit-textarea"
                rows="3"
                maxlength="2000"
                placeholder="Add a description..."
              />
              <div class="edit-actions">
                <button class="btn-cancel-sm" @click="cancelEditDesc">Cancel</button>
                <button class="btn-save-sm" @click="saveDesc" :disabled="savingDesc">
                  {{ savingDesc ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </div>
            <div v-else class="value desc">{{ item.description || t('knowledgeDetailNoDesc') }}</div>
          </div>

          <!-- Tags -->
          <div class="detail-group">
            <div class="content-header">
              <label>Tags</label>
              <span v-if="tagsSaved" class="save-indicator">✓ Saved</span>
            </div>
            <div class="tags-container">
              <span v-for="tag in localTags" :key="tag" class="tag-chip">
                {{ tag }}
                <button v-if="canEdit" class="tag-remove" @click="removeTag(tag)">×</button>
              </span>
              <div v-if="canEdit" class="tag-input-wrap">
                <input
                  v-model="newTag"
                  class="tag-input"
                  placeholder="Add tag..."
                  maxlength="50"
                  @keydown.enter.prevent="addTag"
                />
              </div>
              <span v-if="localTags.length === 0 && !canEdit" class="no-tags">No tags</span>
            </div>
          </div>

          <!-- Organizational Folder -->
          <div class="detail-group" style="margin-top: 16px;">
            <div class="content-header">
              <label>Folder Path</label>
              <button v-if="canEdit && !editingFolder" class="btn-edit" @click="startEditFolder">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
              <span v-if="folderSaved" class="save-indicator">✓ Saved</span>
            </div>
            <div v-if="editingFolder" class="edit-area">
              <input
                v-model="editFolder"
                class="edit-textarea"
                style="height: 38px;"
                placeholder="e.g. HR/Policies/2023"
              />
              <div class="edit-actions">
                <button class="btn-cancel-sm" @click="cancelEditFolder">Cancel</button>
                <button class="btn-save-sm" @click="saveFolder" :disabled="savingFolder">
                  {{ savingFolder ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </div>
            <div v-else class="value desc">
              <span v-if="item.folder">📁 {{ item.folder }}</span>
              <span v-else class="text-muted" style="opacity: 0.6;">(Root)</span>
            </div>
          </div>

          <!-- Expiry / Review Date -->
          <div class="detail-group" style="margin-top: 16px;">
            <div class="content-header">
              <label>Expiry / Review Date</label>
              <button v-if="canEdit && !editingExpires" class="btn-edit" @click="startEditExpires">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
              <span v-if="expiresSaved" class="save-indicator">✓ Saved</span>
            </div>
            <div v-if="editingExpires" class="edit-area">
              <input
                v-model="editExpires"
                type="date"
                class="edit-textarea"
                style="height: 38px;"
              />
              <div class="edit-actions">
                <button class="btn-cancel-sm" @click="cancelEditExpires">Cancel</button>
                <button class="btn-save-sm" @click="saveExpires" :disabled="savingExpires">
                  {{ savingExpires ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </div>
            <div v-else class="value desc">
              <span v-if="item.expiresAt" :class="{ 'text-danger': new Date(item.expiresAt) < new Date() }">
                ⏳ {{ formatDate(item.expiresAt) }}
                <span v-if="new Date(item.expiresAt) < new Date()" style="color:#ef4444; margin-left:8px; font-weight:600; font-size:12px;">(Expired / Needs Review)</span>
              </span>
              <span v-else class="text-muted" style="opacity: 0.6;">(Never Expire)</span>
            </div>
          </div>

          <!-- Source + Created -->
          <div class="detail-row">
            <div class="detail-group">
              <label>{{ t('knowledgeDetailSource') }}</label>
              <div class="value file">{{ item.contentSource }}</div>
            </div>
            <div class="detail-group">
              <label>{{ t('knowledgeDetailCreated') }}</label>
              <div class="value">{{ formatDate(item.createdAt) }}</div>
            </div>
          </div>

          <!-- Content Preview -->
          <div class="detail-group">
            <div class="content-header">
              <label>{{ t('knowledgeDetailContent') }}</label>
              <button v-if="item.content" class="btn-expand" @click="toggleReadMode">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <polyline points="9 21 3 21 3 15"></polyline>
                  <line x1="21" y1="3" x2="14" y2="10"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
                {{ t('knowledgeDetailExpand') }}
              </button>
            </div>

            <div class="content-box">
              <pre v-if="item.content">{{ item.content }}</pre>
              <div v-else class="no-content">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <p>{{ t('knowledgeDetailNoContent') }}</p>
                <small>{{ t('knowledgeDetailNoContentDesc') }}</small>
              </div>
            </div>
          </div>

          <!-- Full Screen Read Modal -->
          <Teleport to="body">
            <Transition name="read-fade">
              <div v-if="showReadMode && item.content" class="read-mode-overlay" @click="toggleReadMode">
                <div class="read-mode-content" @click.stop>
                  <div class="read-header">
                    <h3>{{ item.title }}</h3>
                    <button class="close-btn" @click="toggleReadMode" :aria-label="t('cancel')">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <div class="read-body">
                    <pre>{{ item.content }}</pre>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>

          <!-- Publish Status Section -->
          <div class="status-section" v-if="item.requestStatus && item.requestStatus !== 'none'">
            <h4>{{ t('publishStatus') }}</h4>
            <div class="status-box" :class="item.requestStatus">
              <div class="status-indicator">
                <span class="status-dot" :style="{ background: getStatusColor(item.requestStatus) }"></span>
                <span class="status-label">
                  {{ t('publishStatusLabel') }}: <strong>{{ item.requestStatus }}</strong>
                </span>
              </div>
              <span v-if="item.requestedType" class="target-label">
                {{ t('publishTargetLabel') }}: {{ item.requestedType }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions-section" v-if="isOwner && item.type === 'personal'">
            <h4>{{ t('knowledgeActions') }}</h4>

            <!-- Error banner for publish action -->
            <div v-if="publishError" class="error-inline">
              <span>{{ publishError }}</span>
              <button @click="publishError = ''">×</button>
            </div>

            <!-- Target type selection -->
            <div v-if="!item.requestStatus || item.requestStatus === 'none' || item.requestStatus === 'rejected'" class="publish-target-select" style="margin-bottom: 12px;">
              <label style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 6px; display: block;">{{ t('publishTargetLabel') }}</label>
              <div style="display: flex; gap: 8px;">
                <button
                  class="btn-action"
                  :class="{ 'btn-active': publishTargetType === 'department' }"
                  style="flex: 1; padding: 8px 12px;"
                  @click="publishTargetType = 'department'"
                >{{ t('toDepartment') }}</button>
                <button
                  class="btn-action"
                  :class="{ 'btn-active': publishTargetType === 'public' }"
                  style="flex: 1; padding: 8px 12px;"
                  @click="publishTargetType = 'public'"
                >{{ t('toPublic') }}</button>
              </div>
            </div>

            <div class="btn-group">
              <button
                v-if="!item.requestStatus || item.requestStatus === 'none' || item.requestStatus === 'rejected'"
                class="btn-action"
                :disabled="publishing"
                @click="askPublishConfirm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
                {{ publishing ? t('loadingData') : (isAdmin ? t('directPublishBtn') : t('requestPublishAction')) }}
              </button>
            </div>

            <!-- Inline Publish Confirm -->
            <Transition name="confirm-fade">
              <div v-if="showPublishConfirm" ref="publishConfirmRef" class="publish-confirm">
                <p>{{ isAdmin ? t('confirmDirectPublish').replace('{type}', publishTargetType) : t('confirmPublishRequest').replace('{type}', publishTargetType) }}</p>
                <div class="confirm-btns">
                  <button class="btn-cancel" @click="cancelPublish">{{ t('cancel') }}</button>
                  <button class="btn-confirm" @click="handleRequestPublish">{{ t('confirm') }}</button>
                </div>
              </div>
            </Transition>

            <p v-if="item.requestStatus === 'pending'" class="pending-msg">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {{ t('pendingApproval') }}
            </p>
          </div>
          </template>

          <!-- Analytics Tab -->
          <template v-if="activeTab === 'analytics'">
            <!-- Loading -->
            <div v-if="analyticsLoading" class="analytics-loading">
              <div class="spinner"></div>
              <p>Loading analytics...</p>
            </div>

            <!-- Error -->
            <div v-else-if="analyticsError" class="analytics-error">
              <p>{{ analyticsError }}</p>
              <button class="btn-save-sm" @click="loadAnalytics">Retry</button>
            </div>

            <!-- Analytics Data -->
            <div v-else-if="analytics" class="analytics-content">
              <!-- Stat Cards -->
              <div class="stat-cards">
                <div class="stat-card">
                  <div class="stat-value" :class="getQualityClass(analytics.qualityScore)">
                    {{ analytics.qualityScore }}<span style="font-size: 10px; opacity: 0.7;">/100</span>
                  </div>
                  <div class="stat-label">Quality Score</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ analytics.totalHits }}</div>
                  <div class="stat-label">Total Hits</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ analytics.uniqueUsers }}</div>
                  <div class="stat-label">Unique Users</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value feedback-val">
                    <span class="fb-liked">👍 {{ analytics.feedback.liked }}</span>
                    <span class="fb-disliked">👎 {{ analytics.feedback.disliked }}</span>
                  </div>
                  <div class="stat-label">Feedback</div>
                </div>
              </div>

              <!-- Last Accessed -->
              <div class="detail-group" v-if="analytics.lastAccessed">
                <label>Last Accessed</label>
                <div class="value">{{ formatDate(analytics.lastAccessed) }}</div>
              </div>

              <!-- Daily Hit Chart (last 30 days) -->
              <div class="detail-group" v-if="analytics.dailyHits?.length">
                <label>Daily Hits (30 days)</label>
                <div class="bar-chart">
                  <div
                    v-for="day in analytics.dailyHits"
                    :key="day._id"
                    class="bar-col"
                    :title="`${day._id}: ${day.count} hits`"
                  >
                    <div class="bar" :style="{ height: Math.max((day.count / maxDailyHit) * 80, 4) + 'px' }"></div>
                    <span class="bar-label">{{ day._id.slice(5) }}</span>
                  </div>
                </div>
              </div>

              <!-- Top Queries -->
              <div class="detail-group" v-if="analytics.topQueries?.length">
                <label>Top Queries</label>
                <div class="queries-list">
                  <div v-for="q in analytics.topQueries" :key="q.query" class="query-row">
                    <span class="query-text">{{ q.query }}</span>
                    <span class="query-count">{{ q.count }}×</span>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="analytics.totalHits === 0" class="no-content">
                <p>No usage data yet</p>
                <small>Analytics will appear after this document is used in RAG searches</small>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ─── Modal Transition (spring-like) ─────────────────────────── */
.modal-fade-enter-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-fade-leave-active {
  transition: opacity 0.2s ease-out;
}
.modal-fade-enter-active .knowledge-modal {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-fade-leave-active .knowledge-modal {
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}
.modal-fade-enter-from {
  opacity: 0;
}
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .knowledge-modal {
  transform: translateY(24px) scale(0.92);
  opacity: 0;
}
.modal-fade-leave-to .knowledge-modal {
  transform: translateY(10px) scale(0.96);
  opacity: 0;
}

/* ─── Tabs ───────────────────────────────────────────────────── */
.modal-tabs {
  display: flex;
  gap: 4px;
  padding: 0 24px 0;
  border-bottom: 1px solid var(--color-border);
}

.tab-btn {
  padding: 10px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: -1px;
}
.tab-btn:hover {
  color: var(--color-text-primary);
}
.tab-btn.active {
  color: var(--color-accent, #6366f1);
  border-bottom-color: var(--color-accent, #6366f1);
}

/* ─── Analytics ──────────────────────────────────────────────── */
.analytics-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--color-text-muted);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent, #6366f1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.analytics-error {
  text-align: center;
  padding: 32px;
  color: #ef4444;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}

.stat-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.feedback-val {
  display: flex;
  justify-content: center;
  gap: 12px;
  font-size: 16px;
}
.fb-liked { color: #10b981; }
.fb-disliked { color: #ef4444; }

/* Bar Chart */
.bar-chart {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  min-height: 100px;
  padding: 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow-x: auto;
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 14px;
}

.bar {
  width: 100%;
  max-width: 20px;
  background: linear-gradient(180deg, var(--color-accent, #6366f1), #818cf8);
  border-radius: 3px 3px 0 0;
  transition: height 0.3s ease;
}

.bar-label {
  font-size: 8px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* Queries List */
.queries-list {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
}

.query-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--color-border);
}
.query-row:last-child { border-bottom: none; }

.query-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
}

.query-count {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--color-accent, #6366f1);
  font-size: 12px;
  margin-left: 8px;
}

/* ─── Read Mode Transition ───────────────────────────────────── */
.read-fade-enter-active,
.read-fade-leave-active {
  transition: opacity 0.3s ease;
}
.read-fade-enter-active .read-mode-content,
.read-fade-leave-active .read-mode-content {
  transition: transform 0.3s ease;
}
.read-fade-enter-from { opacity: 0; }
.read-fade-leave-to { opacity: 0; }
.read-fade-enter-from .read-mode-content {
  transform: scale(0.95);
}

/* ─── Confirm Transition ─────────────────────────────────────── */
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: all 0.2s ease;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ─── Overlay ────────────────────────────────────────────────── */
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
  z-index: 1100;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* ─── Modal Container ────────────────────────────────────────── */
.knowledge-modal {
  background: var(--color-bg-card);
  border-radius: 16px;
  width: 540px;
  max-width: 92%;
  max-height: 85vh;
  max-height: 85svh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow:
    0 24px 48px -12px rgba(0, 0, 0, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  overflow: hidden;
}

/* ─── Header ─────────────────────────────────────────────────── */
.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.12));
  color: #60a5fa;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.close-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 8px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

/* ─── Body ───────────────────────────────────────────────────── */
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.detail-group {
  margin-bottom: 18px;
}

.value.title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.version-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-accent);
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.detail-row {
  display: flex;
  gap: 24px;
}
.detail-row .detail-group { flex: 1; }

/* ─── Edit Controls ──────────────────────────────────────────── */
.btn-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--color-accent, #6366f1);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.btn-edit:hover {
  background: rgba(99, 102, 241, 0.1);
}

.save-indicator {
  font-size: 11px;
  font-weight: 600;
  color: #10b981;
  animation: fadeInOut 2s ease forwards;
}
@keyframes fadeInOut {
  0% { opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; }
}

.edit-area {
  margin-top: 4px;
}

.edit-textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-accent, #6366f1);
  border-radius: 8px;
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
  outline: none;
}
.edit-textarea:focus {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.edit-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 6px;
}

.btn-cancel-sm {
  padding: 5px 12px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-cancel-sm:hover { background: var(--color-bg-hover); }

.btn-save-sm {
  padding: 5px 12px;
  background: var(--color-accent, #6366f1);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-save-sm:hover { opacity: 0.9; }
.btn-save-sm:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── Tags ───────────────────────────────────────────────────── */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 32px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: rgba(99, 102, 241, 0.1);
  color: var(--color-accent, #6366f1);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(99, 102, 241, 0.2);
  transition: all 0.15s;
}

.tag-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.tag-remove:hover { opacity: 1; }

.tag-input-wrap {
  flex-shrink: 0;
}

.tag-input {
  width: 100px;
  padding: 4px 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 12px;
  outline: none;
  transition: all 0.15s;
}
.tag-input:focus {
  border-color: var(--color-accent, #6366f1);
  width: 140px;
}
.tag-input::placeholder {
  color: var(--color-text-muted);
}

.no-tags {
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
}

label {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.value {
  font-size: 14px;
  color: var(--color-text-primary);
}

.value.title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.value.desc {
  color: var(--color-text-secondary);
  line-height: 1.6;
  background: var(--color-bg-tertiary);
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
}

.value.file {
  font-family: 'Courier New', monospace;
  background: var(--color-bg-tertiary);
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-block;
  font-size: 13px;
  border: 1px solid var(--color-border);
}

/* ─── Badges ─────────────────────────────────────────────────── */
.badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
/* personal=purple · department=blue · public=green · policy=amber */
.badge.personal   { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; }
.badge.department { background: rgba(59, 130, 246, 0.12);  color: #3b82f6; }
.badge.public     { background: rgba(16, 185, 129, 0.12);  color: #10b981; }
.badge.policy     { background: rgba(245, 158, 11, 0.12);  color: #f59e0b; }

/* ─── Content Preview ────────────────────────────────────────── */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.btn-expand {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.btn-expand:hover {
  background: rgba(99, 102, 241, 0.1);
}

.content-box {
  background: var(--color-bg-tertiary);
  border-radius: 10px;
  padding: 14px;
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
  line-height: 1.6;
}

.no-content {
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.no-content p { margin: 0; font-weight: 500; }
.no-content small { font-size: 11px; opacity: 0.7; }

/* ─── Status Section ─────────────────────────────────────────── */
.status-section {
  margin-top: 8px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border);
}

h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-bg-tertiary);
  font-size: 14px;
  border: 1px solid var(--color-border);
}

.status-box.pending { border-left: 4px solid #f59e0b; }
.status-box.approved { border-left: 4px solid #10b981; }
.status-box.rejected { border-left: 4px solid #ef4444; }

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

/* ─── Actions Section ────────────────────────────────────────── */
.actions-section {
  margin-top: 8px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border);
}

.error-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  color: #f87171;
  font-size: 13px;
  margin-bottom: 12px;
}
.error-inline button {
  background: none;
  border: none;
  color: #f87171;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.btn-group {
  display: flex;
  gap: 8px;
}

.btn-action {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 16px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-primary);
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-action:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-accent), #7c3aed);
  color: white;
  border-color: transparent;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-action.btn-active {
  background: linear-gradient(135deg, var(--color-accent), #7c3aed);
  color: white;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

/* ─── Publish Confirm ────────────────────────────────────────── */
.publish-confirm {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px;
  margin-top: 10px;
}

.publish-confirm p {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.confirm-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 7px 16px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-cancel:hover { background: var(--color-bg-hover); }

.btn-confirm {
  padding: 7px 16px;
  background: var(--color-accent);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-confirm:hover { opacity: 0.9; }

.pending-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #f59e0b;
  font-size: 13px;
  margin-top: 12px;
  padding: 10px;
  background: rgba(245, 158, 11, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.2);
  font-weight: 500;
}

/* ─── Read Mode ──────────────────────────────────────────────── */
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
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.read-mode-content {
  background: var(--color-bg-card);
  width: 800px;
  max-width: 95%;
  height: 90vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 64px -16px rgba(0, 0, 0, 0.35);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.read-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.read-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.read-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--color-bg-tertiary);
}

.read-body pre {
  white-space: pre-wrap;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text-primary);
  max-width: 100%;
  margin: 0;
}

/* ─── Responsive ─────────────────────────────────────────────── */
@media (max-width: 640px) {
  .detail-row {
    flex-direction: column;
    gap: 0;
  }

  .modal-body {
    padding: 16px;
  }

  .value.title {
    font-size: 16px;
  }
}

.quality-high { color: #10b981 !important; text-shadow: 0 0 10px rgba(16, 185, 129, 0.3); }
.quality-medium { color: #f59e0b !important; }
.quality-low { color: #ef4444 !important; }
.quality-unknown { color: var(--color-text-muted) !important; }
</style>
