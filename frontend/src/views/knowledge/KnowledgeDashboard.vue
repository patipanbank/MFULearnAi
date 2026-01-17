<script setup>
import { ref, onMounted } from 'vue'
import { useLanguage } from '@/composables/useSettings'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import KnowledgeList from '../../components/knowledge/KnowledgeList.vue'
import CollectionGrid from '../../components/knowledge/CollectionGrid.vue'
import UploadModal from '../../components/knowledge/UploadModal.vue'
import CreateCollectionModal from '../../components/knowledge/CreateCollectionModal.vue'
import KnowledgeDetailModal from '../../components/knowledge/KnowledgeDetailModal.vue'
import CollectionDetailModal from '../../components/knowledge/CollectionDetailModal.vue'
import AdminRequests from '../../components/knowledge/AdminRequests.vue'

const { t } = useLanguage()
const knowledgeStore = useKnowledgeStore()
const authStore = useAuthStore()

const activeTab = ref('knowledge') // 'knowledge', 'collections', 'requests'
const showUploadModal = ref(false)
const showCollectionModal = ref(false)

const showKnowledgeDetail = ref(false)
const selectedKnowledge = ref(null)

const showCollectionDetail = ref(false)
const selectedCollection = ref(null)

const isAdmin = authStore.role === 'admin'

onMounted(() => {
    // Initial fetch
    knowledgeStore.fetchKnowledge()
    knowledgeStore.fetchCollections()
})

const openKnowledge = (item) => {
    selectedKnowledge.value = item
    showKnowledgeDetail.value = true
}

const openCollection = (col) => {
    selectedCollection.value = col
    showCollectionDetail.value = true
}

const handleCollectionItemOpen = (item) => {
    // Open knowledge detail FROM collection detail
    selectedKnowledge.value = item
    showKnowledgeDetail.value = true
}

</script>

<template>
  <div class="knowledge-dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>{{ t('knowledgeTitle') }}</h1>
        <p class="subtitle">{{ t('knowledgeSubtitle') }}</p>
      </div>
      
      <div class="header-actions">
        <!-- Add Button depending on Tab -->
        <button 
          v-if="activeTab === 'knowledge'"
          class="btn-primary" 
          @click="showUploadModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          {{ t('uploadFile') }}
        </button>

        <button 
          v-if="activeTab === 'collections'"
          class="btn-primary"
          @click="showCollectionModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          {{ t('newCollection') }}
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'knowledge' }"
        @click="activeTab = 'knowledge'"
      >
        {{ t('knowledgeBase') }}
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'collections' }"
        @click="activeTab = 'collections'"
      >
        {{ t('collections') }}
      </button>
      <button 
        v-if="isAdmin"
        class="tab-btn" 
        :class="{ active: activeTab === 'requests' }"
        @click="activeTab = 'requests'"
      >
        Requests <span class="badge-dot" v-if="false"></span>
      </button>
    </div>
    
    <div class="dashboard-content">
      <!-- Knowledge Tab -->
      <div v-if="activeTab === 'knowledge'" class="tab-pane fade-in">
        <KnowledgeList @open="openKnowledge" />
      </div>

      <!-- Collections Tab -->
      <div v-if="activeTab === 'collections'" class="tab-pane fade-in">
        <CollectionGrid @open="openCollection" />
      </div>

      <!-- Admin Requests Tab -->
      <div v-if="activeTab === 'requests'" class="tab-pane fade-in">
        <AdminRequests />
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <UploadModal 
        v-if="showUploadModal" 
        @close="showUploadModal = false"
        @success="showUploadModal = false; knowledgeStore.fetchKnowledge()"
      />
      
      <CreateCollectionModal 
        v-if="showCollectionModal"
        @close="showCollectionModal = false"
        @success="showCollectionModal = false; knowledgeStore.fetchCollections()"
      />

      <KnowledgeDetailModal
        v-if="showKnowledgeDetail && selectedKnowledge"
        :item="selectedKnowledge"
        @close="showKnowledgeDetail = false"
        @success="knowledgeStore.fetchKnowledge()"
      />

      <CollectionDetailModal
        v-if="showCollectionDetail && selectedCollection"
        :collection="selectedCollection"
        @close="showCollectionDetail = false"
        @open-item="handleCollectionItemOpen"
      />
    </Teleport>

  </div>
</template>

<style scoped>
.knowledge-dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 4px 0;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 14px;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 2px;
  background: var(--color-bg-tertiary); /* Container for tab strip */
  padding: 4px 4px 0 4px; /* Slight padding to look integrated */
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0;
  border-radius: 8px 8px 0 0;
}

.tab-btn {
  padding: 10px 24px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border-radius: 6px 6px 0 0;
}

.tab-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.tab-btn.active {
  color: var(--color-accent);
  background: var(--color-bg-secondary);
  border-bottom: 2px solid var(--color-accent);
}

.dashboard-content {
  flex: 1;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-top: none; /* Merged with tabs */
  border-radius: 0 0 12px 12px;
  padding: 24px;
  overflow-y: auto;
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
