<script setup>
import { ref, onMounted, watch, onUnmounted, computed } from 'vue'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const usage = ref({
    today: { tokens: 0, weightedTokens: 0, requests: 0 },
    total: { tokens: 0, weightedTokens: 0, requests: 0 }
})

// Quota config from backend (fetched once on mount)
const quotaConfig = ref({
    dailyLimit: 50000, // Fallback default, overridden by backend
    warningThreshold: 0.8,
    hardLimitEnabled: false,
    unitLabel: 'cost units'
})

const fetchQuotaConfig = async () => {
    try {
        const response = await api.get('/logs/quota/config')
        quotaConfig.value = {
            dailyLimit: response.data.dailyLimit ?? 50000,
            warningThreshold: response.data.warningThreshold ?? 0.8,
            hardLimitEnabled: response.data.hardLimitEnabled ?? false,
            unitLabel: response.data.unitLabel ?? 'cost units'
        }
    } catch (error) {
        console.error('Failed to fetch quota config, using defaults:', error)
    }
}

const fetchUsage = async () => {
    if (!authStore.user?._id) return
    
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

let pollInterval = null

onMounted(async () => {
    await fetchQuotaConfig()
    await fetchUsage()
    
    // Poll every 60 seconds to keep updated
    pollInterval = setInterval(fetchUsage, 60000)
})

onUnmounted(() => {
    if (pollInterval) clearInterval(pollInterval)
})

// Use weighted tokens for quota tracking (reflects actual cost)
const dailyWeightedTokens = computed(() => usage.value.today.weightedTokens || 0)
const dailyLimit = computed(() => quotaConfig.value.dailyLimit)

const percentage = computed(() => {
    const p = (dailyWeightedTokens.value / dailyLimit.value) * 100
    return Math.min(p, 100)
})

const isWarning = computed(() => percentage.value >= quotaConfig.value.warningThreshold * 100)
const isExceeded = computed(() => percentage.value >= 100)

const formatNumber = (num) => {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k'
    }
    return num
}
</script>

<template>
  <div 
    class="token-usage-container" 
    :class="{ 'is-warning': isWarning, 'is-exceeded': isExceeded }"
    v-tooltip="{ content: `Used ${formatNumber(dailyWeightedTokens)} ${quotaConfig.unitLabel} today (Limit: ${formatNumber(dailyLimit)}) | Raw tokens: ${formatNumber(usage.today.tokens)}`, placement: 'top' }"
  >
    <div class="token-text">
        <span class="token-label">USAGE </span>
        <span class="token-value">{{ formatNumber(dailyWeightedTokens) }}</span>
        <span class="token-limit">/{{ formatNumber(dailyLimit) }}</span>
    </div>
    
    <div class="progress-bg">
        <div 
            class="progress-fill" 
            :class="{ 'fill-warning': isWarning, 'fill-exceeded': isExceeded }"
            :style="{ width: percentage + '%' }"
        ></div>
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
    transition: opacity 0.3s ease;
}

.token-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-secondary);
    white-space: nowrap;
    letter-spacing: 0.05em;
    display: flex;
    gap: 2px;
}

.is-warning .token-value {
    color: var(--color-warning, #f59e0b);
}

.is-exceeded .token-value {
    color: var(--color-error, #ef4444);
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

.fill-warning {
    background: var(--color-warning, #f59e0b);
}

.fill-exceeded {
    background: var(--color-error, #ef4444);
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
    
    .token-limit {
        display: block;
        opacity: 0.7;
    }
    
    .progress-bg {
        display: none;
    }
    
    .token-text {
        font-size: 10px;
        background: var(--color-bg-tertiary);
        padding: 2px 6px;
        border-radius: 4px;
        color: var(--color-text-primary);
    }

    .token-value {
        background: none;
        padding: 0;
        color: inherit;
    }
}
</style>
