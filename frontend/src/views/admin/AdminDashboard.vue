<template>
  <div class="admin-dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>{{ t('adminTitle') }}</h1>
        <p class="subtitle">{{ t('adminSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <button
          @click="fetchStats"
          class="btn-secondaryIcon"
          :title="t('refresh')"
          :disabled="loading"
        >
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
        </button>
      </div>
    </div>

    <div class="dashboard-content">
      <!-- Loading State -->
      <div v-if="loading && !loaded" class="loading-state">
        <div class="stats-grid">
          <div v-for="i in 4" :key="i" class="stat-card skeleton">
            <div class="skeleton-icon"></div>
            <div class="skeleton-label"></div>
            <div class="skeleton-value"></div>
          </div>
        </div>
        <div class="charts-grid">
          <div class="chart-card lg-col-2 skeleton">
            <div class="skeleton-chart-title"></div>
            <div class="skeleton-chart"></div>
          </div>
          <div class="chart-card skeleton">
            <div class="skeleton-chart-title"></div>
            <div class="skeleton-chart"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="errorMessage" class="error-state">
        <div class="error-card">
          <i class="fas fa-exclamation-triangle error-icon"></i>
          <p class="error-text">{{ t('errorLoadingData') }}</p>
          <p class="error-detail">{{ errorMessage }}</p>
          <button class="btn-retry" @click="fetchStats">
            <i class="fas fa-redo"></i>
            {{ t('retry') }}
          </button>
        </div>
      </div>

      <!-- Data Loaded -->
      <template v-else>
        <!-- Stats Cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon-bg">
              <i class="fas fa-coins text-accent"></i>
            </div>
            <p class="stat-label">{{ t('totalTokensAllTime') }}</p>
            <h3 class="stat-value">{{ formatNumber(stats.totals.tokens) }}</h3>
          </div>

          <div class="stat-card">
            <div class="stat-icon-bg">
              <i class="fas fa-calendar-day text-blue"></i>
            </div>
            <p class="stat-label">{{ t('tokensToday') }}</p>
            <h3 class="stat-value text-blue">{{ formatNumber(stats.today.tokens) }}</h3>
          </div>

          <div class="stat-card">
            <div class="stat-icon-bg">
              <i class="fas fa-users text-green"></i>
            </div>
            <p class="stat-label">{{ t('activeUsersToday') }}</p>
            <h3 class="stat-value text-green">{{ formatNumber(stats.today.uniqueUsers) }}</h3>
          </div>

          <div class="stat-card">
            <div class="stat-icon-bg">
              <i class="fas fa-exchange-alt text-purple"></i>
            </div>
            <p class="stat-label">{{ t('totalRequestsToday') }}</p>
            <h3 class="stat-value text-purple">{{ formatNumber(stats.today.requests) }}</h3>
          </div>
        </div>

        <!-- Charts -->
        <div class="charts-grid">
          <!-- Daily Trend (Line Chart) -->
          <div class="chart-card lg-col-2">
            <h3 class="card-title">{{ t('usageTrend') }}</h3>
            <div class="chart-container">
              <Line v-if="loaded" :data="lineChartData" :options="lineChartOptions" />
            </div>
          </div>

          <!-- Model Distribution (Doughnut) -->
          <div class="chart-card">
            <h3 class="card-title">{{ t('modelDistribution') }}</h3>
            <div class="chart-container flex-center">
              <Doughnut v-if="loaded && hasDoughnutData" :data="doughnutChartData" :options="doughnutChartOptions" />
              <div v-else class="no-data">{{ t('noUsageData') }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import api from '@/utils/api';
import { useLanguage } from '@/composables/useSettings';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const { t } = useLanguage();

const loading = ref(false);
const loaded = ref(false);
const errorMessage = ref(null);
const stats = ref({
  totals: { tokens: 0, requests: 0 },
  today: { tokens: 0, requests: 0, uniqueUsers: 0 },
  daily: [],
  models: []
});

// --- Theme-aware chart colors ---

const getCssVar = (name) => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const textColor = ref('#9ca3af');
const gridColor = ref('#374151');

const updateChartColors = () => {
  const textPrimary = getCssVar('--color-text-muted') || '#9ca3af';
  const borderColor = getCssVar('--color-border') || '#374151';

  textColor.value = textPrimary;
  gridColor.value = borderColor;
};

// --- Helpers ---

const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num || 0);
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// --- Charts Data ---

// Chart color palette — centralized for easy adjustment
const CHART_COLORS = {
  blue: '#3b82f6',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  pink: '#ec4899'
};

const lineChartData = computed(() => {
  const labels = stats.value.daily.map(d => formatDate(d.date));
  const tokenData = stats.value.daily.map(d => d.tokens);
  const requestData = stats.value.daily.map(d => d.requests);

  return {
    labels,
    datasets: [
      {
        label: t('tokensUsed'),
        backgroundColor: CHART_COLORS.blue,
        borderColor: CHART_COLORS.blue,
        data: tokenData,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: t('requests'),
        backgroundColor: CHART_COLORS.violet,
        borderColor: CHART_COLORS.violet,
        data: requestData,
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  };
});

const lineChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  scales: {
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      grid: { color: gridColor.value },
      ticks: { color: textColor.value }
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: { color: textColor.value }
    },
    x: {
      grid: { color: gridColor.value },
      ticks: { color: textColor.value }
    }
  },
  plugins: {
    legend: { labels: { color: textColor.value } }
  }
}));

const hasDoughnutData = computed(() => {
  return stats.value.models && stats.value.models.length > 0;
});

const doughnutChartData = computed(() => {
  const labels = stats.value.models.map(m => m._id);
  const data = stats.value.models.map(m => m.tokens);
  const colors = Object.values(CHART_COLORS);

  return {
    labels,
    datasets: [
      {
        backgroundColor: colors,
        borderColor: 'transparent',
        data
      }
    ]
  };
});

const doughnutChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: textColor.value }, position: 'bottom' }
  }
}));

// --- Data Fetching ---

const fetchStats = async () => {
  loading.value = true;
  errorMessage.value = null;
  try {
    const response = await api.get('/logs/usage');
    stats.value = response.data;
    loaded.value = true;
    // Update chart colors after data load and DOM render
    setTimeout(updateChartColors, 100);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    errorMessage.value = error.response?.data?.message || error.message || 'Unknown error';
  } finally {
    loading.value = false;
  }
};

// --- Lifecycle ---

onMounted(() => {
  fetchStats();
  window.addEventListener('resize', updateChartColors);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateChartColors);
});
</script>

<style scoped>
.admin-dashboard {
  height: 100%;
  height: 100svh; /* Safari Fix */
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
  background-color: var(--color-bg-primary);
  padding-bottom: env(safe-area-inset-bottom, 24px);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .dashboard-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
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

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-secondaryIcon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondaryIcon:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.dashboard-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 24px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}

@media (min-width: 768px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(4, 1fr); }
}

.stat-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stat-icon-bg {
  position: absolute;
  top: 16px;
  right: 16px;
  opacity: 0.1;
  font-size: 48px;
  pointer-events: none;
}

.stat-label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.text-blue { color: #3b82f6; }
.text-green { color: #10b981; }
.text-purple { color: #8b5cf6; }
.text-accent { color: var(--color-accent); }

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 1024px) {
  .charts-grid { grid-template-columns: 2fr 1fr; }
}

.chart-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 16px;
}

.chart-container {
  height: 300px;
  width: 100%;
  position: relative;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-data {
  color: var(--color-text-muted);
  font-size: 14px;
}

/* Skeleton Loading */
.skeleton .skeleton-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--color-bg-tertiary);
  margin-bottom: 12px;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton .skeleton-label {
  width: 60%;
  height: 12px;
  border-radius: 4px;
  background: var(--color-bg-tertiary);
  margin-bottom: 8px;
  animation: shimmer 1.5s ease-in-out infinite;
  animation-delay: 0.1s;
}

.skeleton .skeleton-value {
  width: 40%;
  height: 24px;
  border-radius: 4px;
  background: var(--color-bg-tertiary);
  animation: shimmer 1.5s ease-in-out infinite;
  animation-delay: 0.2s;
}

.skeleton .skeleton-chart-title {
  width: 50%;
  height: 16px;
  border-radius: 4px;
  background: var(--color-bg-tertiary);
  margin-bottom: 16px;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton .skeleton-chart {
  flex: 1;
  min-height: 200px;
  border-radius: 8px;
  background: var(--color-bg-tertiary);
  animation: shimmer 1.5s ease-in-out infinite;
  animation-delay: 0.15s;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

/* Error State */
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
}

.error-card {
  text-align: center;
  max-width: 400px;
}

.error-icon {
  font-size: 48px;
  color: var(--color-text-muted);
  margin-bottom: 16px;
  opacity: 0.5;
}

.error-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.error-detail {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: 24px;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-retry:hover {
  opacity: 0.9;
}

/* Responsive */
@media (max-width: 640px) {
  .admin-dashboard {
    padding: 16px;
  }

  .dashboard-content {
    padding-bottom: 16px;
  }
}
</style>
