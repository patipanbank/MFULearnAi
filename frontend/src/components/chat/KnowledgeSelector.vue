<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

const isOpen = ref(false)
const dropdownRef = ref(null)
const dropdownPosition = reactive({ top: 0, left: 0, width: 320 })

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

const updatePosition = () => {
    if (dropdownRef.value) {
        const rect = dropdownRef.value.getBoundingClientRect()
        dropdownPosition.top = rect.bottom + 8
        dropdownPosition.left = rect.left
        // Ensure it doesn't go off screen right
        if (dropdownPosition.left + 320 > window.innerWidth) {
            dropdownPosition.left = window.innerWidth - 330
        }
    }
}

const toggleDropdown = async () => {
    if (!isOpen.value) {
        isOpen.value = true
        await nextTick()
        updatePosition()
    } else {
        isOpen.value = false
    }
}

const selectCollection = (id) => {
    chatStore.currentCollectionId = id
    isOpen.value = false
}

// Close on click outside
const closeOnClickOutside = (e) => {
    // Check if click is on the trigger button (dropdownRef contains it)
    if (dropdownRef.value && dropdownRef.value.contains(e.target)) {
        return
    }
    // Note: click inside the teleported dropdown is handled by checking e.target closest
    if (e.target.closest('.dropdown-menu')) {
        return
    }
    isOpen.value = false
}

const handleResize = () => {
    if (isOpen.value) isOpen.value = false
}

onMounted(() => {
    document.addEventListener('click', closeOnClickOutside)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true) // Close on scroll to avoid floating issues
})

onUnmounted(() => {
    document.removeEventListener('click', closeOnClickOutside)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('scroll', handleResize, true)
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
        <!-- Dropdown Menu (Teleported to Body) -->
        <Teleport to="body">
            <transition name="dropdown">
                <div 
                    v-if="isOpen" 
                    class="dropdown-menu"
                    :style="{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                    }"
                >
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
        </Teleport>
    </div>
</template>

/* Premium Styling */
.knowledge-selector {
    position: relative;
    z-index: 50;
}

.selector-trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 6px 6px 8px; /* Refined padding */
    background: rgba(30, 41, 59, 0.6); /* Glassy dark background */
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    min-width: 180px;
    color: var(--color-text-primary);
    backdrop-filter: blur(8px);
}

.selector-trigger:hover, .selector-trigger.active {
    background: rgba(30, 41, 59, 0.9);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.label-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
}

.label-main {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}

.chevron {
    color: var(--color-text-secondary);
    transition: transform 0.2s ease;
    margin-right: 8px;
}

.selector-trigger:hover .chevron {
    color: var(--color-text-primary);
}

/* Dropdown Menu - Premium Overlay */
.dropdown-menu {
    position: fixed;
    width: 320px;
    background: #1e293b; /* Solid dark/slate background base */
    background: linear-gradient(145deg, #1e293b, #0f172a); /* Subtle gradient */
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    box-shadow: 
        0 4px 6px -1px rgba(0, 0, 0, 0.1), 
        0 10px 15px -3px rgba(0, 0, 0, 0.1),
        0 20px 25px -5px rgba(0, 0, 0, 0.2); /* Deep shadow */
    overflow: hidden;
    transform-origin: top left;
    z-index: 9999;
}

.menu-header {
    padding: 16px 16px 8px 16px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #94a3b8; /* Slate-400 */
    letter-spacing: 0.05em;
    background: transparent;
}

.menu-list {
    max-height: 360px;
    overflow-y: auto;
    padding: 8px;
}

.menu-item {
    width: 100%;
    display: flex;
    align-items: flex-start; /* Align top for multi-line text */
    gap: 14px;
    padding: 12px;
    border-radius: 12px;
    transition: all 0.2s ease;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    margin-bottom: 4px;
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
    width: 40px;
    height: 40px;
    border-radius: 12px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.05);
    color: #cbd5e1; /* Slate-300 */
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.item-icon.default-icon { color: #4ade80; background: rgba(74, 222, 128, 0.1); }
.item-icon.personal-icon { color: #60a5fa; background: rgba(96, 165, 250, 0.1); }
.item-icon.dept-icon { color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
.item-icon.public-icon { color: #94a3b8; background: rgba(148, 163, 184, 0.1); }

.item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-top: 2px;
}

.item-title {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: #f1f5f9; /* Slate-100 */
    margin-bottom: 2px;
}

.item-desc {
    display: block;
    font-size: 13px;
    color: #94a3b8; /* Slate-400 */
    line-height: 1.4;
}

.check-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: #60a5fa; /* Blue-400 */
    background: rgba(96, 165, 250, 0.1);
    border-radius: 50%;
    margin-top: 8px; /* Align with text roughly */
}

.divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 8px 12px;
}

/* Animations */
.dropdown-enter-active,
.dropdown-leave-active {
    transition: opacity 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-enter-from,
.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
}

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}
</style>
