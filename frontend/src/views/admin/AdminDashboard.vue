<template>
  <div class="admin-dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>Admin Dashboard</h1>
        <p class="subtitle">System usage statistics and performance metrics.</p>
      </div>
      <div class="header-actions">
           <button 
            @click="fetchStats" 
            class="btn-secondaryIcon"
            title="Refresh"
            :disabled="loading"
          >
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
          </button>
      </div>
    </div>

    <div class="dashboard-content">
        <!-- Stats Cards -->
        <div class="stats-grid">
           <div class="stat-card">
              <div class="stat-icon-bg">
                  <i class="fas fa-coins text-accent"></i>
              </div>
              <p class="stat-label">Total Tokens (All Time)</p>
              <h3 class="stat-value">{{ formatNumber(stats.totals.tokens) }}</h3>
           </div>

           <div class="stat-card">
              <div class="stat-icon-bg">
                  <i class="fas fa-calendar-day text-blue"></i>
              </div>
              <p class="stat-label">Tokens (Today)</p>
              <h3 class="stat-value text-blue">{{ formatNumber(stats.today.tokens) }}</h3>
           </div>

           <div class="stat-card">
              <div class="stat-icon-bg">
                  <i class="fas fa-users text-green"></i>
              </div>
              <p class="stat-label">Active Users (Today)</p>
              <h3 class="stat-value text-green">{{ formatNumber(stats.today.uniqueUsers) }}</h3>
           </div>

           <div class="stat-card">
              <div class="stat-icon-bg">
                  <i class="fas fa-exchange-alt text-purple"></i>
              </div>
              <p class="stat-label">Total Requests (Today)</p>
              <h3 class="stat-value text-purple">{{ formatNumber(stats.today.requests) }}</h3>
           </div>
        </div>

        <!-- Charts -->
        <div class="charts-grid">
            <!-- Daily Trend (Line Chart) -->
            <div class="chart-card lg-col-2">
                <h3 class="card-title">Usage Trend (Last 7 Days)</h3>
                <div class="chart-container">
                    <Line v-if="loaded" :data="lineChartData" :options="lineChartOptions" />
                </div>
            </div>

            <!-- Model Distribution (Doughnut) -->
            <div class="chart-card">
                <h3 class="card-title">Model Distribution</h3>
                 <div class="chart-container flex-center">
                    <Doughnut v-if="loaded" :data="doughnutChartData" :options="doughnutChartOptions" />
                    <div v-else class="no-data">No usage data</div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';
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

const loading = ref(false);
const loaded = ref(false);
const stats = ref({
    totals: { tokens: 0, requests: 0 },
    today: { tokens: 0, requests: 0, uniqueUsers: 0 },
    daily: [],
    models: []
});

// Helper to get CSS variable value
const getCssVar = (name) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const textColor = ref('#9ca3af');
const gridColor = ref('#374151');

const updateChartColors = () => {
    // Basic detection or fallback. Ideally this reacts to theme changes.
    // Since we don't have a direct theme listener here easiest is to rely on simple neutral colors
    // or read the properly set variables if possible.
    // For now, let's use a safe gray that works reasonably on both high contrast modes,
    // but ideally we'd use the variables.
    
    // We will attempt to read variables, but they might not be set on 'document' if scoped weirdly,
    // usually they are on :root.
    const textPrimary = getCssVar('--color-text-muted') || '#9ca3af';
    const borderColor = getCssVar('--color-border') || '#374151';
    
    textColor.value = textPrimary;
    gridColor.value = borderColor;
};


const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
};

// --- Charts Data ---

const lineChartData = computed(() => {
    const labels = stats.value.daily.map(d => formatDate(d.date));
    const tokenData = stats.value.daily.map(d => d.tokens);
    const requestData = stats.value.daily.map(d => d.requests);

    return {
        labels,
        datasets: [
            {
                label: 'Tokens Used',
                backgroundColor: '#3b82f6', // blue-500
                borderColor: '#3b82f6',
                data: tokenData,
                tension: 0.4,
                yAxisID: 'y'
            },
            {
                label: 'Requests',
                backgroundColor: '#8b5cf6', // violet-500
                borderColor: '#8b5cf6',
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

const doughnutChartData = computed(() => {
    const labels = stats.value.models.map(m => m._id);
    const data = stats.value.models.map(m => m.tokens);
    // Premium palette
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

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

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()}`;
};

const fetchStats = async () => {
    loading.value = true;
    try {
        const response = await axios.get('/api/logs/usage');
        stats.value = response.data;
        loaded.value = true;
        // Update colors after data load (and potential DOM render)
        setTimeout(updateChartColors, 100);
    } catch (error) {
        console.error('Failed to fetch stats:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchStats();
    window.addEventListener('resize', updateChartColors); // Re-check on resize might help if theme changes
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
  background-color: var(--color-bg-primary); /* Ensure explicit bg */
  /* Safari Safe Area */
  padding-bottom: env(safe-area-inset-bottom, 24px);
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
@media (min-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }

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
    box-shadow: 0 4px 12px rgba(0,0,0,0.05); /* Subtle shadow */
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

.text-blue { color: #3b82f6; } /* Tailwind blue-500 equivalent */
.text-green { color: #10b981; } /* Tailwind emerald-500 equivalent */
.text-purple { color: #8b5cf6; } /* Tailwind violet-500 equivalent */
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
</style>
