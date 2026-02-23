<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLanguage } from '@/composables/useSettings'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import KnowledgeList from '@/components/knowledge/KnowledgeList.vue'
import CollectionGrid from '@/components/knowledge/CollectionGrid.vue'
import UploadModal from '@/components/knowledge/UploadModal.vue'
import CreateCollectionModal from '@/components/knowledge/CreateCollectionModal.vue'
import KnowledgeDetailModal from '@/components/knowledge/KnowledgeDetailModal.vue'
import CollectionDetailModal from '@/components/knowledge/CollectionDetailModal.vue'
import AdminRequestsModal from '@/components/knowledge/AdminRequestsModal.vue'

const { t } = useLanguage()
const knowledgeStore = useKnowledgeStore()
const authStore = useAuthStore()

const activeTab = ref('knowledge')
const showUploadModal = ref(false)
const showCollectionModal = ref(false)
const showAdminModal = ref(false)

const showKnowledgeDetail = ref(false)
const selectedKnowledge = ref(null)

const showCollectionDetail = ref(false)
const selectedCollection = ref(null)

const editingCollection = ref(null)

const isAdmin = computed(() => authStore.role === 'admin' || authStore.role === 'superadmin')

const pendingCount = ref(0)

const fetchPendingCount = async () => {
    if (!isAdmin.value) return
    try {
        const items = await knowledgeStore.fetchPendingRequests()
        pendingCount.value = items?.length || 0
    } catch (e) {
        console.warn('Failed to fetch pending count', e)
    }
}

onMounted(() => {
    knowledgeStore.fetchKnowledge()
    knowledgeStore.fetchCollections()
    fetchPendingCount()
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
    selectedKnowledge.value = item
    showKnowledgeDetail.value = true
}

const openEditCollection = (col) => {
    editingCollection.value = col
    showCollectionModal.value = true
}

const closeCollectionModal = () => {
    showCollectionModal.value = false
    editingCollection.value = null
}

const handleUploadSuccess = () => {
    showUploadModal.value = false
    knowledgeStore.fetchKnowledge()
}

const handleCollectionSuccess = () => {
    closeCollectionModal()
    knowledgeStore.fetchCollections()
}

const statsLoaded = ref(false)
const switchDashboardTab = async (tab) => {
    activeTab.value = tab
    if (tab === 'stats' && !statsLoaded.value) {
        try {
            await knowledgeStore.fetchStats()
            statsLoaded.value = true
        } catch (e) {
            console.error('Failed to load stats', e)
        }
    }
}

const maxTrendHit = computed(() => {
    if (!knowledgeStore.stats?.dailyTrend?.length) return 1
    return Math.max(...knowledgeStore.stats.dailyTrend.map(d => d.count), 1)
})
</script>

<template>
  <div class="knowledge-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1>{{ t('knowledgeTitle') }}</h1>
        <p class="subtitle">{{ t('knowledgeSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <button v-if="activeTab === 'knowledge'" class="btn-primary" @click="showUploadModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          {{ t('uploadFile') }}
        </button>
        <button v-if="activeTab === 'collections'" class="btn-primary" @click="showCollectionModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          {{ t('newCollection') }}
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <div class="tabs-left">
        <button class="tab-btn" :class="{ active: activeTab === 'knowledge' }" @click="switchDashboardTab('knowledge')">
          {{ t('knowledgeBase') }}
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'collections' }" @click="switchDashboardTab('collections')">
          {{ t('collections') }}
        </button>
        <button v-if="isAdmin" class="tab-btn" :class="{ active: activeTab === 'stats' }" @click="switchDashboardTab('stats')">
          📊 Stats
        </button>
      </div>
      <button v-if="isAdmin" class="btn-admin" @click="showAdminModal = true">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        {{ t('manageRequests') }}
        <span v-if="pendingCount > 0" class="badge-count">{{ pendingCount }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="dashboard-content">
      <div v-if="activeTab === 'knowledge'" class="tab-pane fade-in">
        <KnowledgeList @open="openKnowledge" />
      </div>
      <div v-if="activeTab === 'collections'" class="tab-pane fade-in">
        <CollectionGrid @open="openCollection" @edit="openEditCollection" />
      </div>
      <div v-if="activeTab === 'stats'" class="tab-pane fade-in">
        <div v-if="knowledgeStore.statsLoading" class="stats-loading">
          <div class="stats-spinner"></div>
          <p>Loading analytics...</p>
        </div>
        <div v-else-if="knowledgeStore.stats" class="stats-content">
          <div class="stats-overview">
            <div class="overview-card">
              <div class="ov-value">{{ knowledgeStore.stats.totals.knowledge }}</div>
              <div class="ov-label">Total Documents</div>
            </div>
            <div class="overview-card">
              <div class="ov-value">{{ knowledgeStore.stats.totals.hits }}</div>
              <div class="ov-label">Total Hits</div>
            </div>
            <div class="overview-card">
              <div class="ov-value">👍 {{ knowledgeStore.stats.feedback.liked }}</div>
              <div class="ov-label">Liked</div>
            </div>
            <div class="overview-card">
              <div class="ov-value">👎 {{ knowledgeStore.stats.feedback.disliked }}</div>
              <div class="ov-label">Disliked</div>
            </div>
          </div>
          <div class="stats-section" v-if="knowledgeStore.stats.dailyTrend?.length">
            <h3>7-Day Hit Trend</h3>
            <div class="trend-chart">
              <div v-for="day in knowledgeStore.stats.dailyTrend" :key="day._id" class="trend-bar-col" :title="`${day._id}: ${day.count} hits`">
                <div class="trend-bar" :style="{ height: Math.max((day.count / maxTrendHit) * 100, 6) + 'px' }"></div>
                <span class="trend-label">{{ day._id.slice(5) }}</span>
                <span class="trend-count">{{ day.count }}</span>
              </div>
            </div>
          </div>
          <div class="stats-section" v-if="knowledgeStore.stats.topDocs?.length">
            <h3>Top Used Documents</h3>
            <div class="stats-table">
              <div v-for="doc in knowledgeStore.stats.topDocs" :key="doc._id" class="stats-row">
                <div class="stats-doc-info">
                  <span class="stats-doc-title">{{ doc.title }}</span>
                  <span class="stats-doc-meta">{{ doc.type }} · {{ doc.department }}</span>
                </div>
                <div class="stats-doc-numbers">
                  <span class="stats-hits">{{ doc.hitCount }} hits</span>
                  <span class="stats-users">{{ doc.uniqueUserCount }} users</span>
                </div>
              </div>
            </div>
          </div>
          <div class="stats-section" v-if="knowledgeStore.stats.neverUsed?.length">
            <h3>⚠️ Never Used Documents ({{ knowledgeStore.stats.totals.neverUsedCount }})</h3>
            <div class="stats-table">
              <div v-for="doc in knowledgeStore.stats.neverUsed" :key="doc._id" class="stats-row unused">
                <span class="stats-doc-title">{{ doc.title }}</span>
                <span class="stats-doc-meta">{{ doc.type }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <UploadModal v-if="showUploadModal" @close="showUploadModal = false" @success="handleUploadSuccess" />
      <CreateCollectionModal v-if="showCollectionModal" :collection="editingCollection" @close="closeCollectionModal" @success="handleCollectionSuccess" />
      <KnowledgeDetailModal v-if="showKnowledgeDetail && selectedKnowledge" :item="selectedKnowledge" @close="showKnowledgeDetail = false" @success="knowledgeStore.fetchKnowledge()" />
      <CollectionDetailModal v-if="showCollectionDetail && selectedCollection" :collection="selectedCollection" @close="showCollectionDetail = false" @open-item="handleCollectionItemOpen" />
      <AdminRequestsModal v-if="showAdminModal" @close="showAdminModal = false; fetchPendingCount()" />
    </Teleport>
  </div>
</template>

<style scoped>
/*
  ROOT CAUSE ของปัญหา column ไม่แสดง:
  ใน flex column chain ทุก level ต้องมี min-height: 0
  ไม่งั้น flex children จะ overflow parent แล้วถูก clip โดย overflow: hidden

  chain: .knowledge-dashboard → .dashboard-content → .tab-pane → KnowledgeList
  ทุกตัวต้องมี min-height: 0
*/

.knowledge-dashboard {
  display: flex;
  flex-direction: column;
  height: 100%;
  height: 100svh;
  min-height: 0;        /* ← FIX */
  padding: 24px;
  padding-bottom: env(safe-area-inset-bottom, 24px);
  overflow: hidden;
  box-sizing: border-box;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .dashboard-header { flex-direction: column; gap: 16px; align-items: stretch; }
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 4px 0;
}

.subtitle { color: var(--color-text-muted); font-size: 14px; margin: 0; }

.header-actions { display: flex; gap: 8px; align-items: center; }

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
  white-space: nowrap;
}
.btn-primary:hover { opacity: 0.9; }

.btn-admin {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.08));
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 8px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  white-space: nowrap;
}
.btn-admin:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.15));
  border-color: rgba(99, 102, 241, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  font-size: 11px;
  font-weight: 700;
  border-radius: 20px;
  animation: badge-pulse 2s ease-in-out infinite;
}
@keyframes badge-pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.1); }
}

/* ─── Tabs ───────────────────────────────────────────────────── */
.tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-bg-tertiary);
  padding: 4px 12px 0 4px;
  border-bottom: 1px solid var(--color-border);
  border-radius: 8px 8px 0 0;
  flex-shrink: 0;   /* ← ห้ามหด */
}

.tabs-left { display: flex; gap: 2px; }

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
  border-radius: 6px 6px 0 0;
  white-space: nowrap;
}
.tab-btn:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }
.tab-btn.active {
  color: var(--color-accent);
  background: var(--color-bg-secondary);
  border-bottom: 2px solid var(--color-accent);
}

/* ─── Content ────────────────────────────────────────────────── */
.dashboard-content {
  flex: 1;
  min-height: 0;    /* ← FIX: ให้ขยาย/หดได้ ไม่ overflow */
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 12px 12px;
  padding: 24px;
  overflow-y: auto;
  box-sizing: border-box;
}

.tab-pane {
  min-height: 0;    /* ← FIX: ป้องกัน KnowledgeList overflow ออกมา */
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .knowledge-dashboard { padding: 16px; }
  .dashboard-content   { padding: 16px; }
}

/* ─── Stats ──────────────────────────────────────────────────── */
.stats-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px;
  color: var(--color-text-muted);
}

.stats-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: statsSpin 0.8s linear infinite;
}
@keyframes statsSpin { to { transform: rotate(360deg); } }

.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
@media (max-width: 768px) { .stats-overview { grid-template-columns: repeat(2, 1fr); } }

.overview-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 18px;
  text-align: center;
}

.ov-value { font-size: 26px; font-weight: 700; color: var(--color-text-primary); letter-spacing: -0.02em; }
.ov-label { font-size: 11px; color: var(--color-text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; margin-top: 4px; }

.stats-section { margin-bottom: 24px; }
.stats-section h3 { font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 12px 0; }

.trend-chart {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  min-height: 130px;
  padding: 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.trend-bar-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.trend-bar { width: 100%; max-width: 40px; background: linear-gradient(180deg, var(--color-accent, #6366f1), #818cf8); border-radius: 4px 4px 0 0; transition: height 0.4s ease; }
.trend-label { font-size: 10px; color: var(--color-text-muted); }
.trend-count  { font-size: 11px; font-weight: 600; color: var(--color-text-secondary); }

.stats-table { background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; }

.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.1s;
}
.stats-row:last-child { border-bottom: none; }
.stats-row:hover      { background: var(--color-bg-hover); }
.stats-row.unused     { opacity: 0.6; }

.stats-doc-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.stats-doc-title { font-size: 14px; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats-doc-meta  { font-size: 11px; color: var(--color-text-muted); }

.stats-doc-numbers { display: flex; gap: 12px; flex-shrink: 0; }
.stats-hits  { font-size: 13px; font-weight: 600; color: var(--color-accent, #6366f1); }
.stats-users { font-size: 13px; color: var(--color-text-muted); }
</style>