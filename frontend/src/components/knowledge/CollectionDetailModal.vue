<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useModalKeyboard } from '@/composables/useModalKeyboard'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useLanguage } from '@/composables/useSettings'

const { confirm: showConfirm } = useConfirmDialog()
const { t } = useLanguage()

const props = defineProps({
  collection: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'open-item', 'edit', 'deleted'])

const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()
const fullCollection = ref(null)
const isLoading = ref(true)
const actionLoading = ref(null) // track which item is being added/removed

// ── Keyboard support ──
const modalRef = ref(null)
useModalKeyboard({
  onClose: () => emit('close'),
  modalRef,
})

// For Mapping Mode
const isMapping = ref(false)
const availableKnowledge = ref([])
const searchQuery = ref('')
const searchInputRef = ref(null)
const deleteLoading = ref(false)

onMounted(async () => {
    await fetchDetails()
})

const fetchDetails = async () => {
    isLoading.value = true
    try {
        await knowledgeStore.fetchCollectionDetails(props.collection._id)
        fullCollection.value = knowledgeStore.currentCollection
    } catch (e) {
        console.error(e)
    } finally {
        isLoading.value = false
    }
}

const isOwner = computed(() => {
    if (!fullCollection.value) return false
    if (authStore.role === 'superadmin') return true
    if (fullCollection.value.type === 'personal') return fullCollection.value.ownerId === authStore.userId
    if (fullCollection.value.type === 'department') return authStore.role === 'admin' && authStore.department === fullCollection.value.department
    if (fullCollection.value.type === 'default') return authStore.role === 'admin'
    return false
})

const items = computed(() => fullCollection.value?.knowledgeIds || [])

const filteredAvailable = computed(() => {
    if (!searchQuery.value) return availableKnowledge.value
    return availableKnowledge.value.filter(k => k.title.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const getTypeLabel = (type) => {
    switch (type) {
        case 'default': return t('filterPublic')
        case 'department': return t('filterDepartment')
        case 'personal': return t('filterPersonal')
        default: return type
    }
}

const getTypeColor = (type) => {
    switch (type) {
        case 'personal': return 'badge-personal'
        case 'department': return 'badge-department'
        case 'default': return 'badge-default'
        default: return 'badge-default'
    }
}

// Toggle Mapping Mode
const toggleMapping = async () => {
    if (!isMapping.value) {
        await knowledgeStore.fetchKnowledge()
        const currentIds = items.value.filter(k => k).map(k => k._id)
        // Exclude policy KB — policies are accessed automatically via check_policy tool, not through collections
        availableKnowledge.value = knowledgeStore.knowledge.filter(k => !currentIds.includes(k._id) && k.type !== 'policy')
        isMapping.value = true
        // Focus search after toggle
        setTimeout(() => searchInputRef.value?.focus(), 100)
    } else {
        isMapping.value = false
        searchQuery.value = ''
    }
}

const handleAdd = async (knowledgeId) => {
    actionLoading.value = knowledgeId
    try {
        await knowledgeStore.mapKnowledge(props.collection._id, knowledgeId, 'add')
        fullCollection.value = knowledgeStore.currentCollection
        availableKnowledge.value = availableKnowledge.value.filter(k => k._id !== knowledgeId)
    } catch (e) {
        console.error('Add to collection failed', e)
    } finally {
        actionLoading.value = null
    }
}

const handleRemove = async (knowledgeId) => {
    if(!await showConfirm(t('confirmRemoveFromCollection'), { variant: 'warning' })) return
    actionLoading.value = knowledgeId
    try {
        await knowledgeStore.mapKnowledge(props.collection._id, knowledgeId, 'remove')
        fullCollection.value = knowledgeStore.currentCollection
    } catch (e) {
        console.error('Remove from collection failed', e)
    } finally {
        actionLoading.value = null
    }
}

const getFileIcon = (type) => {
    if (!type) return '📄'
    if (type.includes('pdf')) return '📕'
    if (type.includes('image')) return '🖼️'
    if (type.includes('doc') || type.includes('word')) return '📘'
    if (type.includes('sheet') || type.includes('excel')) return '📊'
    if (type.includes('text')) return '📝'
    if (type.includes('url')) return '🔗'
    return '📄'
}

const handleEditCollection = () => {
    emit('edit', props.collection)
}

const handleDeleteCollection = async () => {
    if (!await showConfirm(t('confirmDeleteCollection'), { variant: 'danger' })) return
    deleteLoading.value = true
    try {
        await knowledgeStore.deleteCollection(props.collection._id)
        emit('deleted')
    } catch (e) {
        console.error('Delete collection failed', e)
    } finally {
        deleteLoading.value = false
    }
}
</script>

<template>
  <Transition name="modal-fade" appear>
    <div class="modal-overlay" @click="$emit('close')">
      <Transition name="modal-slide" appear>
        <div ref="modalRef" class="collection-modal" @click.stop>
          <div class="modal-header">
            <div class="header-content">
                <h3>{{ collection.name }}</h3>
                <div class="header-meta">
                  <span class="badge" :class="getTypeColor(collection.type)">{{ getTypeLabel(collection.type) }}</span>
                  <span class="item-count-badge" v-if="!isLoading">{{ items.length }} {{ t('collectionItemCount') }}</span>
                </div>
            </div>
            <div class="header-actions">
              <button v-if="isOwner" class="header-btn" @click="handleEditCollection" v-tooltip="{ content: t('editCollection'), placement: 'bottom' }">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button v-if="isOwner" class="header-btn header-btn-danger" @click="handleDeleteCollection" :disabled="deleteLoading" v-tooltip="{ content: t('deleteBtn'), placement: 'bottom' }">
                <svg v-if="deleteLoading" class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
              <button class="close-btn" @click="$emit('close')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div class="modal-content" v-if="!isLoading && fullCollection">
              <p v-if="fullCollection.description" class="desc">{{ fullCollection.description }}</p>
              <p v-else class="desc desc-empty">{{ t('collectionNoDesc') }}</p>

              <div class="section-header">
                  <h4>{{ t('collectionContents') }} ({{ items.length }})</h4>
                  <button v-if="isOwner" class="btn-sm" :class="{ 'btn-sm-done': isMapping }" @click="toggleMapping">
                      <svg v-if="!isMapping" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {{ isMapping ? t('doneBtn') : t('addContentBtn') }}
                  </button>
              </div>

              <!-- List Content -->
              <Transition name="fade-switch" mode="out-in">
                <div v-if="!isMapping" key="content-list" class="content-list">
                    <TransitionGroup name="item-list">
                      <div v-for="item in items.filter(i => i)" :key="item._id" class="content-item" @click="$emit('open-item', item)">
                          <div class="item-icon">{{ getFileIcon(item.type) }}</div>
                          <div class="item-info">
                              <div class="item-title">{{ item.title }}</div>
                              <div class="item-meta">{{ item.type }} • {{ new Date(item.createdAt).toLocaleDateString() }}</div>
                          </div>
                          <button v-if="isOwner" class="btn-remove" :disabled="actionLoading === item._id" @click.stop="handleRemove(item._id)" v-tooltip="{ content: t('removeFromCollectionBtn'), placement: 'left' }">
                            <svg v-if="actionLoading === item._id" class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                      </div>
                    </TransitionGroup>
                    <div v-if="items.filter(i => i).length === 0" class="empty-state">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.4; margin-bottom: 8px;">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        <p>{{ t('emptyCollection') }}</p>
                        <p v-if="isOwner" class="empty-hint">{{ t('emptyCollectionHint') }}</p>
                    </div>
                </div>

                <!-- Mapping Mode -->
                <div v-else key="mapping-ui" class="mapping-ui">
                    <div class="search-wrapper">
                      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input
                        ref="searchInputRef"
                        v-model="searchQuery"
                        :placeholder="t('searchKnowledgeToAdd')"
                        class="search-input"
                      />
                      <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div class="candidates-list">
                        <TransitionGroup name="item-list">
                          <div v-for="k in filteredAvailable" :key="k._id" class="candidate-item">
                              <div class="item-icon">{{ getFileIcon(k.type) }}</div>
                              <div class="candidate-info">
                                  <div class="candidate-title">{{ k.title }}</div>
                                  <div class="candidate-meta">{{ k.type }}</div>
                              </div>
                              <button class="btn-add" :disabled="actionLoading === k._id" @click="handleAdd(k._id)">
                                <svg v-if="actionLoading === k._id" class="spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                                <template v-else>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  {{ t('addBtn') }}
                                </template>
                              </button>
                          </div>
                        </TransitionGroup>
                        <div v-if="filteredAvailable.length === 0" class="empty-state">
                            {{ t('noMatchingKnowledge') }}
                        </div>
                    </div>
                </div>
              </Transition>
          </div>

          <div v-else class="loading">
              <div class="loading-spinner"></div>
              <p>{{ t('loadingData') }}</p>
          </div>
          
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* Modal transitions */
.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.modal-slide-enter-active { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-slide-leave-active { transition: all 0.15s ease-in; }
.modal-slide-enter-from { opacity: 0; transform: translateY(16px) scale(0.97); }
.modal-slide-leave-to { opacity: 0; transform: translateY(8px) scale(0.98); }

/* Content switch transition */
.fade-switch-enter-active { transition: all 0.2s ease-out; }
.fade-switch-leave-active { transition: all 0.15s ease-in; }
.fade-switch-enter-from { opacity: 0; transform: translateX(8px); }
.fade-switch-leave-to { opacity: 0; transform: translateX(-8px); }

/* Item list transitions */
.item-list-enter-active { transition: all 0.25s ease; }
.item-list-leave-active { transition: all 0.2s ease; }
.item-list-enter-from { opacity: 0; transform: translateY(8px); }
.item-list-leave-to { opacity: 0; transform: translateX(-12px); }

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

.collection-modal {
  background: var(--color-bg-card);
  padding: 0;
  border-radius: 14px;
  width: 600px;
  max-width: 92vw;
  height: 80vh;
  max-height: 700px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}

.header-content h3 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
}

.header-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.header-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
}
.header-btn:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
    color: var(--color-accent);
}
.header-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.header-btn-danger:hover {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
}

.badge {
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.3px;
}

/* personal=purple · department=blue · default(public)=green */
.badge-personal   { background: rgba(139,92,246,0.12); color: #8b5cf6; }
.badge-department { background: rgba(59,130,246,0.12);  color: #3b82f6; }
.badge-default    { background: rgba(16,185,129,0.12);  color: #10b981; }

.item-count-badge {
    font-size: 12px;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    padding: 2px 8px;
    border-radius: 12px;
}

.close-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.15s;
  flex-shrink: 0;
}
.close-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border);
  color: var(--color-text-primary);
}

.modal-content {
    padding: 20px 24px;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
}

.desc {
    color: var(--color-text-secondary);
    margin: 0 0 20px 0;
    line-height: 1.5;
    font-size: 14px;
}

.desc-empty {
    font-style: italic;
    opacity: 0.6;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.section-header h4 {
    margin: 0;
    font-size: 13px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.3px;
}

.btn-sm {
    padding: 5px 12px;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
}
.btn-sm:hover { opacity: 0.9; }

.btn-sm-done {
    background: #10b981;
}

.content-list, .candidates-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.content-item, .candidate-item {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background: var(--color-bg-tertiary);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
}

.content-item:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-border);
}

.candidate-item {
    cursor: default;
}

.item-icon {
    font-size: 20px;
    margin-right: 12px;
    flex-shrink: 0;
}

.item-info, .candidate-info {
    flex: 1;
    min-width: 0;
}

.item-title, .candidate-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.item-meta, .candidate-meta {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 2px;
}

.btn-remove {
    background: none;
    border: 1px solid transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
}
.btn-remove:hover { color: #ef4444; background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.15); }
.btn-remove:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-add {
    padding: 5px 12px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s;
    flex-shrink: 0;
}
.btn-add:hover { background: #059669; }
.btn-add:disabled { opacity: 0.5; cursor: not-allowed; }

/* Search wrapper */
.search-wrapper {
    position: relative;
    margin-bottom: 12px;
}

.search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    pointer-events: none;
}

.search-input {
    width: 100%;
    padding: 10px 36px 10px 34px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-input, var(--color-bg-secondary));
    color: var(--color-text-primary);
    font-size: 13px;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.search-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent, #6366f1) 12%, transparent);
}

.search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
}
.search-clear:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

.empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--color-text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
}

.empty-state p { margin: 0; }

.empty-hint {
    font-size: 12px;
    margin-top: 4px !important;
    opacity: 0.7;
}

.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    gap: 12px;
    color: var(--color-text-muted);
}

.loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

.spinner {
    animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
