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
            @click="toggleDropdown"
            class="selector-trigger group"
            :class="{ 'active': isOpen }"
        >
            <div class="icon-wrapper">
                <!-- Globe Icon (Default) -->
                <svg v-if="currentIcon === 'globe'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-emerald-400" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                
                <!-- User Icon (Personal) -->
                <svg v-else-if="currentIcon === 'user'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-purple-400" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                
                <!-- Building Icon (Department) -->
                <svg v-else-if="currentIcon === 'building'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-blue-400" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="12" y1="18" x2="12" y2="18.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="12" y1="6" x2="12" y2="6.01"></line><line x1="8" y1="18" x2="8" y2="18.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line><line x1="8" y1="6" x2="8" y2="6.01"></line><line x1="16" y1="18" x2="16" y2="18.01"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="16" y1="6" x2="16" y2="6.01"></line></svg>
            
                <!-- Book Icon (Fallback) -->
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-amber-400" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </div>

            <div class="label-wrapper">
                <span class="label-xs">{{ t('activeKnowledge') }}</span>
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
                        <div class="item-icon bg-emerald-500/10 text-emerald-400">
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
                                 'bg-purple-500/10 text-purple-400': col.type === 'personal',
                                 'bg-blue-500/10 text-blue-400': col.type === 'department',
                                 'bg-amber-500/10 text-amber-400': col.type === 'public'
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
    padding: 6px 16px 6px 10px;
    background: rgba(30, 41, 59, 0.4); /* Slate 800 with opacity */
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: 9999px; /* Pill shape */
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    min-width: 200px;
}

.selector-trigger:hover, .selector-trigger.active {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(148, 163, 184, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 50%;
    border: 1px solid rgba(148, 163, 184, 0.1);
}

.label-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1;
    min-width: 0; /* truncate fix */
}

.label-xs {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b; /* Slate 500 */
    line-height: 1;
    margin-bottom: 2px;
}

.label-main {
    font-size: 13px;
    font-weight: 500;
    color: #e2e8f0; /* Slate 200 */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
}

.chevron {
    color: #64748b;
    transition: transform 0.2s ease;
}

.group:hover .chevron {
    color: #94a3b8;
}

/* Dropdown Menu */
.dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0; /* Aligned left */
    width: 320px;
    background: rgba(15, 23, 42, 0.95); /* Slate 900 */
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 16px;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    transform-origin: top left;
}

.menu-header {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.05em;
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
}

.menu-item:hover {
    background: rgba(255, 255, 255, 0.05);
}

.menu-item.selected {
    background: rgba(59, 130, 246, 0.1); /* Blue tint */
    border-color: rgba(59, 130, 246, 0.2);
}

.item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    flex-shrink: 0;
}

.item-content {
    flex: 1;
    min-width: 0;
}

.item-title {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #f1f5f9;
}

.item-desc {
    display: block;
    font-size: 12px;
    color: #94a3b8;
    margin-top: 1px;
}

.check-icon {
    color: #3b82f6; /* Blue 500 */
    animation: scaleIn 0.2s ease;
}

.divider {
    height: 1px;
    background: rgba(148, 163, 184, 0.1);
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
    background: rgba(148, 163, 184, 0.2);
    border-radius: 4px;
}
</style>
