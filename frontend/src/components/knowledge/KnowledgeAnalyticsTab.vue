<script setup>
import { ref, computed, onMounted } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'

const props = defineProps({
  itemId: { type: String, required: true },
})

const knowledgeStore = useKnowledgeStore()

const analytics  = ref(null)
const loading    = ref(false)
const errorMsg   = ref('')

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

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const d = new Date(dateString)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const loadAnalytics = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    analytics.value = await knowledgeStore.fetchDocumentAnalytics(props.itemId)
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Failed to load analytics'
  } finally {
    loading.value = false
  }
}

onMounted(loadAnalytics)
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="analytics-loading">
    <div class="spinner"></div>
    <p>Loading analytics...</p>
  </div>

  <!-- Error -->
  <div v-else-if="errorMsg" class="analytics-error">
    <p>{{ errorMsg }}</p>
    <button class="btn-retry" @click="loadAnalytics">Retry</button>
  </div>

  <!-- Analytics Data -->
  <div v-else-if="analytics" class="analytics-content">
    <!-- Stat Cards -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-value" :class="getQualityClass(analytics.qualityScore)">
          {{ analytics.qualityScore }}<span class="stat-unit">/100</span>
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

<style scoped>
.analytics-loading {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 40px 0; color: var(--color-text-muted);
}
.spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent, #6366f1);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.analytics-error { text-align: center; padding: 32px; color: #ef4444; }
.btn-retry {
  margin-top: 8px; padding: 6px 16px;
  background: var(--color-accent, #6366f1); color: white;
  border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: opacity 0.15s;
}
.btn-retry:hover { opacity: 0.85; }

.stat-cards {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 10px; margin-bottom: 18px;
}
.stat-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border); border-radius: 10px;
  padding: 14px; text-align: center;
}
.stat-value {
  font-size: 22px; font-weight: 700;
  color: var(--color-text-primary); letter-spacing: -0.02em;
}
.stat-unit { font-size: 10px; opacity: 0.7; }
.stat-label {
  font-size: 11px; color: var(--color-text-muted);
  text-transform: uppercase; font-weight: 600;
  letter-spacing: 0.5px; margin-top: 4px;
}
.feedback-val { display: flex; justify-content: center; gap: 12px; font-size: 16px; }
.fb-liked    { color: #10b981; }
.fb-disliked { color: #ef4444; }

/* Bar Chart */
.bar-chart {
  display: flex; gap: 3px; align-items: flex-end;
  min-height: 100px; padding: 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border); border-radius: 10px;
  overflow-x: auto;
}
.bar-col {
  display: flex; flex-direction: column; align-items: center;
  gap: 4px; flex: 1; min-width: 14px;
}
.bar {
  width: 100%; max-width: 20px;
  background: linear-gradient(180deg, var(--color-accent, #6366f1), #818cf8);
  border-radius: 3px 3px 0 0; transition: height 0.3s ease;
}
.bar-label { font-size: 8px; color: var(--color-text-muted); white-space: nowrap; }

/* Queries List */
.queries-list {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden;
}
.query-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; font-size: 13px;
  border-bottom: 1px solid var(--color-border);
}
.query-row:last-child { border-bottom: none; }
.query-text {
  flex: 1; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; color: var(--color-text-primary);
}
.query-count {
  flex-shrink: 0; font-weight: 600;
  color: var(--color-accent, #6366f1); font-size: 12px; margin-left: 8px;
}

.detail-group { margin-bottom: 18px; }
.detail-group label {
  display: block; font-size: 11px; font-weight: 700;
  color: var(--color-text-muted); text-transform: uppercase;
  letter-spacing: 0.5px; margin-bottom: 6px;
}
.value { font-size: 14px; color: var(--color-text-primary); }

.no-content {
  text-align: center; padding: 24px;
  color: var(--color-text-muted); font-size: 13px;
}
.no-content small { opacity: 0.7; }

/* Quality Score classes */
.quality-high    { color: #10b981; }
.quality-medium  { color: #f59e0b; }
.quality-low     { color: #ef4444; }
.quality-unknown { color: var(--color-text-muted); }
</style>
