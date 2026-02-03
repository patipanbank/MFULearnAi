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
  <div class="token-usage-container" :title="`Used ${formatNumber(usage.today.tokens)} tokens today (Soft Limit: ${formatNumber(DAILY_LIMIT)})`">
    <!-- Icon & Count -->
    <div class="token-content">
        <span class="icon">⚡</span>
        <div class="text-group">
            <span class="count">{{ formatNumber(usage.today.tokens) }}</span>
            <span class="label">Tokens</span>
        </div>
    </div>
    
    <!-- Mini Progress Bar -->
    <div class="progress-bg">
        <div class="progress-fill" :style="{ width: percentage() + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.token-usage-container {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: var(--color-bg-tertiary); /* Match selector bg */
    border-radius: 9999px; /* Pill shape match selector */
    border: 1px solid var(--color-border);
    cursor: help;
    height: 36px; /* Match selector height */
}

.token-content {
    display: flex;
    align-items: center;
    gap: 6px;
}

.icon { 
    font-size: 14px; 
    color: var(--color-accent);
}

.text-group {
    display: flex;
    flex-direction: column;
    justify-content: center;
    line-height: 1;
}

.count {
    font-weight: 600;
    font-size: 13px;
    color: var(--color-text-primary);
}

.label {
    font-size: 9px;
    text-transform: uppercase;
    color: var(--color-text-muted);
}

.progress-bg {
    width: 40px; /* Small fixed width */
    height: 6px;
    background: var(--color-bg-primary);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--color-border-light);
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 3px;
    transition: width 0.5s ease;
}
</style>
