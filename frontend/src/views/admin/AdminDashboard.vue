<template>
  <div class="h-full flex flex-col bg-gray-900 text-white p-6 overflow-y-auto">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold mb-1">Admin Dashboard</h1>
        <p class="text-gray-400 text-sm">System usage statistics and performance metrics.</p>
      </div>
      <button 
        @click="fetchStats" 
        class="p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
        title="Refresh"
      >
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
       <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm relative overflow-hidden">
          <div class="absolute right-0 top-0 p-4 opacity-5">
              <i class="fas fa-coins text-6xl"></i>
          </div>
          <p class="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Total Tokens (All Time)</p>
          <h3 class="text-2xl font-bold text-white">{{ formatNumber(stats.totals.tokens) }}</h3>
       </div>

       <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm relative overflow-hidden">
          <div class="absolute right-0 top-0 p-4 opacity-5">
              <i class="fas fa-calendar-day text-6xl"></i>
          </div>
          <p class="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Tokens (Today)</p>
          <h3 class="text-2xl font-bold text-blue-400">{{ formatNumber(stats.today.tokens) }}</h3>
       </div>

       <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm relative overflow-hidden">
          <div class="absolute right-0 top-0 p-4 opacity-5">
              <i class="fas fa-users text-6xl"></i>
          </div>
          <p class="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Active Users (Today)</p>
          <h3 class="text-2xl font-bold text-green-400">{{ formatNumber(stats.today.uniqueUsers) }}</h3>
       </div>

       <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm relative overflow-hidden">
          <div class="absolute right-0 top-0 p-4 opacity-5">
              <i class="fas fa-exchange-alt text-6xl"></i>
          </div>
          <p class="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Total Requests (Today)</p>
          <h3 class="text-2xl font-bold text-purple-400">{{ formatNumber(stats.today.requests) }}</h3>
       </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <!-- Daily Trend (Line Chart) -->
        <div class="lg:col-span-2 bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm">
            <h3 class="text-lg font-semibold mb-4 text-gray-200">Usage Trend (Last 7 Days)</h3>
            <div class="relative h-[300px] w-full">
                <Line v-if="loaded" :data="lineChartData" :options="lineChartOptions" />
            </div>
        </div>

        <!-- Model Distribution (Doughnut) -->
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm">
            <h3 class="text-lg font-semibold mb-4 text-gray-200">Model Distribution</h3>
             <div class="relative h-[300px] w-full flex items-center justify-center">
                <Doughnut v-if="loaded" :data="doughnutChartData" :options="doughnutChartOptions" />
                <div v-else class="text-gray-500 text-sm">No usage data</div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
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
                backgroundColor: '#60A5FA', // blue-400
                borderColor: '#60A5FA',
                data: tokenData,
                tension: 0.4,
                yAxisID: 'y'
            },
            {
                label: 'Requests',
                backgroundColor: '#A78BFA', // purple-400
                borderColor: '#A78BFA',
                data: requestData,
                tension: 0.4,
                yAxisID: 'y1'
            }
        ]
    };
});

const lineChartOptions = {
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
            grid: { color: '#374151' },
            ticks: { color: '#9CA3AF' }
        },
        y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
             ticks: { color: '#9CA3AF' }
        },
        x: {
             grid: { color: '#374151' },
             ticks: { color: '#9CA3AF' }
        }
    },
    plugins: {
        legend: { labels: { color: '#D1D5DB' } }
    }
};

const doughnutChartData = computed(() => {
    const labels = stats.value.models.map(m => m._id);
    const data = stats.value.models.map(m => m.tokens);
    // Simple palette
    const colors = ['#60A5FA', '#34D399', '#A78BFA', '#FBBF24', '#EF4444', '#EC4899'];

    return {
        labels,
        datasets: [
            {
                backgroundColor: colors,
                data
            }
        ]
    };
});

const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: '#D1D5DB' }, position: 'bottom' }
    }
};

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
    } catch (error) {
        console.error('Failed to fetch stats:', error);
        // Mock data fallback for dev if needed
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchStats();
});
</script>
