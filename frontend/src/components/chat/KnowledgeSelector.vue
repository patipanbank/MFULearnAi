<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

const isOpen = ref(false)
const dropdownRef = ref(null)

// Computed for current selection display
const currentCollectionName = computed(() => {
    if (!chatStore.currentCollectionId) return t('defaultCollection')
    const col = knowledgeStore.collections.find(c => c._id === chatStore.currentCollectionId)
    return col ? col.name : t('defaultCollection')
})

const currentIcon = computed(() => {
    if (!chatStore.currentCollectionId) return 'globe'
    const col = knowledgeStore.collections.find(c => c._id === chatStore.currentCollectionId)
    if (!col) return 'globe'
    if (col.type === 'personal') return 'user'
    if (col.type === 'department') return 'building'
    return 'book'
})

// Formatting helper
const getIconForType = (type) => {
    switch(type) {
        case 'personal': return 'user'
        case 'department': return 'building'
        default: return 'book'
    }
}

const toggleDropdown = () => isOpen.value = !isOpen.value

const selectCollection = (id) => {
    chatStore.currentCollectionId = id
    isOpen.value = false
}

// Close on click outside
const closeOnClickOutside = (e) => {
    if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
        isOpen.value = false
    }
}

onMounted(() => {
    document.addEventListener('click', closeOnClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', closeOnClickOutside)
})
</script>

<template>
    <div class="knowledge-selector relative" ref="dropdownRef">
        <!-- Trigger Button -->
        <button 
            @click.stop="toggleDropdown"
            class="selector-trigger group"
            :class="{ 'active': isOpen }"
        >
            <div class="icon-wrapper">
                <!-- Globe Icon (Default) -->
                <svg v-if="currentIcon === 'globe'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-[var(--color-success)]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                
                <!-- User Icon (Personal) -->
                <svg v-else-if="currentIcon === 'user'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-[var(--color-accent)]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                
                <!-- Building Icon (Department) -->
                <svg v-else-if="currentIcon === 'building'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-[var(--color-warning)]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="12" y1="18" x2="12" y2="18.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="12" y1="6" x2="12" y2="6.01"></line><line x1="8" y1="18" x2="8" y2="18.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line><line x1="8" y1="6" x2="8" y2="6.01"></line><line x1="16" y1="18" x2="16" y2="18.01"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="16" y1="6" x2="16" y2="6.01"></line></svg>
            
                <!-- Book Icon (Fallback) -->
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-[var(--color-text-secondary)]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </div>

            <div class="label-wrapper">
                <span class="label-main">{{ currentCollectionName }}</span>
            </div>

            <svg 
                class="chevron" 
                :class="{ 'rotate-180': isOpen }"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </button>

        <!-- Dropdown Menu -->
        <transition name="dropdown">
            <div v-if="isOpen" class="dropdown-menu">
                <div class="menu-header">
                    <span>{{ t('selectContext') }}</span>
                </div>
                
                <div class="menu-list custom-scrollbar">
                    <!-- Default Option -->
                    <button 
                        @click="selectCollection(null)"
                        class="menu-item"
                        :class="{ 'selected': !chatStore.currentCollectionId }"
                    >
                        <div class="item-icon default-icon">
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                        </div>
                        <div class="item-content">
                            <span class="item-title">{{ t('defaultCollection') }}</span>
                            <span class="item-desc">General knowledge base</span>
                        </div>
                        <div v-if="!chatStore.currentCollectionId" class="check-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                    </button>

                    <div class="divider"></div>

                    <!-- Dynamic Options -->
                    <button 
                        v-for="col in knowledgeStore.collections" 
                        :key="col._id"
                        @click="selectCollection(col._id)"
                        class="menu-item"
                        :class="{ 'selected': chatStore.currentCollectionId === col._id }"
                    >
                        <!-- Icon Logic -->
                        <div class="item-icon" 
                             :class="{
                                 'personal-icon': col.type === 'personal',
                                 'dept-icon': col.type === 'department',
                                 'public-icon': col.type === 'public'
                             }">
                            <svg v-if="col.type === 'personal'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            <svg v-else-if="col.type === 'department'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="12" y1="18" x2="12" y2="18.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line></svg>
                            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        </div>

                        <div class="item-content">
                            <span class="item-title">{{ col.name }}</span>
                            <span class="item-desc capitalize">{{ col.type }} Collection</span>
                        </div>
                        
                        <div v-if="chatStore.currentCollectionId === col._id" class="check-icon">
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                    </button>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.knowledge-selector {
    position: relative;
    z-index: 50;
}

.selector-trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px 6px 6px; /* Adjusted padding */
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 9999px; /* Pill shape */
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    min-width: 180px; /* Reduced min-width */
    color: var(--color-text-primary);
}

.selector-trigger:hover, .selector-trigger.active {
    background: var(--color-bg-hover);
    border-color: var(--color-border-light);
    box-shadow: var(--shadow-sm);
}

.icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-bg-primary);
    border-radius: 50%;
    border: 1px solid var(--color-border);
}

.label-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
}

.label-main {
    font-size: 14px; /* Increased font size */
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}

.chevron {
    color: var(--color-text-secondary);
    transition: transform 0.2s ease;
}

.selector-trigger:hover .chevron {
    color: var(--color-text-primary);
}

/* Dropdown Menu */
.dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 320px;
    background: var(--color-bg-primary); /* Use solid color to prevent transparency issues in light mode */
    border: 1px solid var(--color-border);
    border-radius: 16px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    transform-origin: top left;
    z-index: 1000;
}

.menu-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    letter-spacing: 0.05em;
    background: var(--color-bg-secondary);
}

.menu-list {
    max-height: 300px;
    overflow-y: auto;
    padding: 6px;
}

.menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 12px;
    transition: all 0.15s ease;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
}

.menu-item:hover {
    background: var(--color-bg-hover);
}

.menu-item.selected {
    background: var(--color-accent-light);
    border-color: var(--color-accent-light);
}

.item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    flex-shrink: 0;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
}

/* Icon Colors using variables where possible or specific style adjustments */
.default-icon {
    background: rgba(34, 197, 94, 0.1);
    color: var(--color-success);
}

.personal-icon {
    background: rgba(59, 130, 246, 0.1);
    color: var(--color-accent);
}

.dept-icon {
    background: rgba(245, 158, 11, 0.1);
    color: var(--color-warning);
}

.public-icon {
    background: rgba(100, 116, 139, 0.1);
    color: var(--color-text-secondary);
}

.item-content {
    flex: 1;
    min-width: 0;
}

.item-title {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
}

.item-desc {
    display: block;
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-top: 1px;
}

.check-icon {
    color: var(--color-accent);
    animation: scaleIn 0.2s ease;
}

.divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 10px;
}

@keyframes scaleIn {
    from { transform: scale(0); }
    to { transform: scale(1); }
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-enter-from,
.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
}

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 4px;
}
</style>
