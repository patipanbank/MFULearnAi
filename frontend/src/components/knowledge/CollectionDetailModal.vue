<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useModalKeyboard } from '@/composables/useModalKeyboard'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

const { confirm: showConfirm } = useConfirmDialog()

const props = defineProps({
  collection: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'open-item'])

const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()
const fullCollection = ref(null)
const isLoading = ref(true)

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

// Toggle Mapping Mode
const toggleMapping = async () => {
    if (!isMapping.value) {
        // Fetch all available knowledge to select from
        // We need a way to fetch 'all' or 'candidates'. 
        // For now, fetch all user has access to.
        await knowledgeStore.fetchKnowledge()
        // Filter out already mapped ones (safeguard against nulls)
        const currentIds = items.value.filter(k => k).map(k => k._id)
        availableKnowledge.value = knowledgeStore.knowledge.filter(k => !currentIds.includes(k._id))
    }
    isMapping.value = !isMapping.value
}

const handleAdd = async (knowledgeId) => {
    await knowledgeStore.mapKnowledge(props.collection._id, knowledgeId, 'add')
    // Update local state is handled by store fetching details again? 
    // The store 'mapKnowledge' refetches details if currentCollection matches.
    // But we need to update available list too.
    
    // Refresh available
    const newAdded = availableKnowledge.value.find(k => k._id === knowledgeId)
    if (newAdded) {
        // Manually update local view for speed or rely on store? 
        // Store updates `currentCollection`.
        fullCollection.value = knowledgeStore.currentCollection
        availableKnowledge.value = availableKnowledge.value.filter(k => k._id !== knowledgeId)
    }
}

const handleRemove = async (knowledgeId) => {
    if(!await showConfirm('Remove this item from collection?', { variant: 'warning' })) return
    await knowledgeStore.mapKnowledge(props.collection._id, knowledgeId, 'remove')
    fullCollection.value = knowledgeStore.currentCollection
}

</script>

<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div ref="modalRef" class="collection-modal" @click.stop>
      <div class="modal-header">
        <div class="header-content">
            <h3>{{ collection.name }}</h3>
            <span class="badge" :class="collection.type">{{ collection.type }}</span>
        </div>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-content" v-if="!isLoading && fullCollection">
          <p class="desc">{{ fullCollection.description }}</p>

          <div class="section-header">
              <h4>Contents ({{ items.length }})</h4>
              <button v-if="isOwner" class="btn-sm" @click="toggleMapping">
                  {{ isMapping ? 'Done' : '+ Add Content' }}
              </button>
          </div>

          <!-- List Content -->
          <div class="content-list" v-if="!isMapping">
              <div v-for="item in items.filter(i => i)" :key="item._id" class="content-item" @click="$emit('open-item', item)">
                  <div class="item-icon">📄</div>
                  <div class="item-info">
                      <div class="item-title">{{ item.title }}</div>
                      <div class="item-meta">{{ item.type }} • {{ new Date(item.createdAt).toLocaleDateString() }}</div>
                  </div>
                  <button v-if="isOwner" class="btn-remove" @click.stop="handleRemove(item._id)">×</button>
              </div>
              <div v-if="items.length === 0" class="empty-state">
                  This collection is empty.
              </div>
          </div>

          <!-- Mapping Mode -->
          <div class="mapping-ui" v-else>
              <input v-model="searchQuery" placeholder="Search knowledge to add..." class="search-input" autoFocus />
              <div class="candidates-list">
                  <div v-for="k in filteredAvailable" :key="k._id" class="candidate-item">
                      <div class="candidate-info">
                          <div class="candidate-title">{{ k.title }}</div>
                          <div class="candidate-meta">{{ k.type }}</div>
                      </div>
                      <button class="btn-add" @click="handleAdd(k._id)">Add</button>
                  </div>
                   <div v-if="filteredAvailable.length === 0" class="empty-state">
                      No matching knowledge found to add.
                  </div>
              </div>
          </div>

      </div>
      <div v-else class="loading">
          Loading details...
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

.collection-modal {
  background: var(--color-bg-card);
  padding: 0;
  border-radius: 12px;
  width: 600px;
  height: 80vh; /* Fixed height for scrollable content */
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-content h3 {
    margin: 0 0 8px 0;
    font-size: 20px;
}

.badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-text-muted);
}

.modal-content {
    padding: 24px;
    flex: 1;
    overflow-y: auto;
}

.desc {
    color: var(--color-text-secondary);
    margin: 0 0 24px 0;
    line-height: 1.5;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.section-header h4 {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
    text-transform: uppercase;
}

.btn-sm {
    padding: 4px 12px;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
}

.content-list, .candidates-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.content-item, .candidate-item {
    display: flex;
    align-items: center;
    padding: 12px;
    background: var(--color-bg-tertiary);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
}

.content-item:hover {
    background: var(--color-bg-hover);
}

.item-icon {
    font-size: 20px;
    margin-right: 12px;
}

.item-info, .candidate-info {
    flex: 1;
}

.item-title, .candidate-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
}

.item-meta, .candidate-meta {
    font-size: 12px;
    color: var(--color-text-muted);
}

.btn-remove {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 0 8px;
}
.btn-remove:hover { color: #ef4444; }

.btn-add {
    padding: 4px 12px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
}

.search-input {
    width: 100%;
    padding: 10px;
    margin-bottom: 12px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
}

.empty-state {
    text-align: center;
    padding: 32px;
    color: var(--color-text-muted);
}
</style>
