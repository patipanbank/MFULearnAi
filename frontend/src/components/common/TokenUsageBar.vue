<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const usage = ref({
    today: { tokens: 0, requests: 0 },
    total: { tokens: 0, requests: 0 }
})

// Visual limit for bar (e.g., 50k tokens daily target)
const DAILY_LIMIT = 50000 

const fetchUsage = async () => {
    if (!authStore.user?._id) return
    
    // Don't show loading spinner for background updates, just silent update
    try {
        const response = await axios.get('/api/logs/usage/me', {
            params: { userId: authStore.user._id }
        })
        usage.value = response.data
    } catch (error) {
        console.error('Failed to fetch token usage:', error)
    }
}

onMounted(() => {
    fetchUsage()
    
    // Poll every 60 seconds to keep updated
    setInterval(fetchUsage, 60000)
})

const percentage = () => {
    const p = (usage.value.today.tokens / DAILY_LIMIT) * 100
    return Math.min(p, 100)
}

const formatNumber = (num) => {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k'
    }
    return num
}
</script>

<template>
  <div class="token-usage-container" :title="`Used ${usage.today.tokens} tokens today (Soft Limit: ${formatNumber(DAILY_LIMIT)})`">
    <div class="token-info">
        <span class="icon">🪙</span>
        <span class="count">{{ formatNumber(usage.today.tokens) }}</span>
        <span class="label">Today</span>
    </div>
    <div class="progress-bg">
        <div class="progress-fill" :style="{ width: percentage() + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.token-usage-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--color-bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--color-border);
    min-width: 100px;
    cursor: help;
}

.token-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    line-height: 1;
}

.icon { font-size: 14px; }

.count {
    font-weight: 700;
    color: var(--color-text-primary);
}

.label {
    color: var(--color-text-muted);
    font-size: 10px;
    text-transform: uppercase;
}

.progress-bg {
    width: 100%;
    height: 4px;
    background: var(--color-bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 2px;
    transition: width 0.5s ease;
}
</style>
