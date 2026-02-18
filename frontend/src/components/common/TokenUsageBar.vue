<script setup>
import { ref, onMounted, watch } from 'vue'
import api from '@/utils/api'
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
        const response = await api.get('/logs/usage/me', {
            params: { userId: authStore.user._id }
        })
        usage.value = response.data
    } catch (error) {
        console.error('Failed to fetch token usage:', error)
    }
}

// Watch for manual triggers from other components (like ChatStore)
watch(() => authStore.tokenUpdateTrigger, () => {
    console.log('[TokenUsageBar] Manual refresh triggered - waiting for persistence...')
    // Small delay to ensure background tasks and DB persistence are complete
    setTimeout(fetchUsage, 2000)
})

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
    <div class="token-text">
        <span class="token-label">TOKEN </span>
        <span class="token-value">{{ formatNumber(usage.today.tokens) }}</span>
        <span class="token-limit">/{{ formatNumber(DAILY_LIMIT) }}</span>
    </div>
    
    <div class="progress-bg">
        <div class="progress-fill" :style="{ width: percentage() + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.token-usage-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    background: transparent;
    border: none;
    cursor: help;
    height: 36px;
}

.token-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-secondary); /* Muted text */
    white-space: nowrap;
    letter-spacing: 0.05em;
    display: flex;
    gap: 2px;
}

.progress-bg {
    width: 50px;
    height: 4px;
    background: var(--color-bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 2px;
    transition: width 0.5s ease;
}

@media (max-width: 1024px) {
    .token-usage-container {
        padding: 0;
        gap: 4px;
        height: auto;
    }
    
    .token-label {
        display: none;
    }
    
    /* Show limit on mobile now */
    .token-limit {
        display: block;
        opacity: 0.7;
    }
    
    .progress-bg {
        display: none; /* Hide progress bar on mobile to save space */
    }
    
    /* Apply badge style to the whole text container */
    .token-text {
        font-size: 10px;
        background: var(--color-bg-tertiary);
        padding: 2px 6px;
        border-radius: 4px;
        color: var(--color-text-primary);
    }

    .token-value {
        /* Reset individual style */
        background: none;
        padding: 0;
        color: inherit;
    }
}
</style>
