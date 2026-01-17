<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

const isOpen = ref(false)
const searchQuery = ref('')
const dropdownRef = ref(null)
const dropdownPosition = reactive({ top: 0, left: 0, maxHeight: 400 })

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

// Filter collections based on search query
const filteredCollections = computed(() => {
    if (!knowledgeStore.collections) return []
    
    // First filter out duplicate 'Default Collection'
    let result = knowledgeStore.collections.filter(c => c.name !== 'Default Collection')
    
    // Then filter by search query if it exists
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(c => 
            c.name.toLowerCase().includes(query) || 
            (c.type && c.type.toLowerCase().includes(query))
        )
    }
    
    return result
})

const updatePosition = () => {
    if (dropdownRef.value) {
        const rect = dropdownRef.value.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        
        dropdownPosition.top = rect.bottom + 8
        dropdownPosition.left = rect.left
        
        // Ensure it doesn't go off screen
        if (dropdownPosition.left + 320 > window.innerWidth) {
            dropdownPosition.left = window.innerWidth - 330
        }
        
        dropdownPosition.maxHeight = Math.min(spaceBelow - 20, 400)
    }
}

const toggleDropdown = async () => {
    if (!isOpen.value) {
        isOpen.value = true
        searchQuery.value = '' // Reset search on open
        await nextTick()
        updatePosition()
        
        // Focus search input
        const input = document.getElementById('knowledge-search-input')
        if (input) input.focus()
    } else {
        isOpen.value = false
    }
}

const selectCollection = (id) => {
    chatStore.currentCollectionId = id
    isOpen.value = false
}

const closeDropdown = () => {
    isOpen.value = false
}

const handleScrollResize = () => {
    if (isOpen.value) updatePosition()
}

onMounted(() => {
    window.addEventListener('resize', handleScrollResize)
    window.addEventListener('scroll', handleScrollResize, true)
})

onUnmounted(() => {
    window.removeEventListener('resize', handleScrollResize)
    window.removeEventListener('scroll', handleScrollResize, true)
})
</script>

<template>
    <div class="knowledge-selector" ref="dropdownRef">
        <!-- Trigger Button -->
        <button 
            @click.stop="toggleDropdown"
            class="selector-trigger group"
            :class="{ 'active': isOpen }"
        >
            <div class="icon-wrapper">
                <svg v-if="currentIcon === 'globe'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-[var(--color-success)]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                <svg v-else-if="currentIcon === 'user'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-[var(--color-accent)]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <svg v-else-if="currentIcon === 'building'" width="16" height="16" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-[var(--color-warning)]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="12" y1="18" x2="12" y2="18.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="12" y1="6" x2="12" y2="6.01"></line><line x1="8" y1="18" x2="8" y2="18.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line><line x1="8" y1="6" x2="8" y2="6.01"></line><line x1="16" y1="18" x2="16" y2="18.01"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="16" y1="6" x2="16" y2="6.01"></line></svg>
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

        <!-- Use body for max reliability against container styles -->
        <Teleport to="body">
            <div v-if="isOpen" class="overlay-container">
                <!-- Backdrop -->
                <div class="backdrop" @click="closeDropdown"></div>
                
                <!-- Dropdown -->
                <div 
                    class="dropdown-menu"
                    id="knowledge-dropdown-menu"
                    :style="{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        maxHeight: `${dropdownPosition.maxHeight}px`,
                        display: 'block' 
                    }"
                >
                    <div class="menu-header">
                        <span>{{ t('selectContext') }}</span>
                    </div>

                    <!-- Search Input -->
                    <div class="search-container">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input 
                                id="knowledge-search-input"
                                type="text" 
                                v-model="searchQuery" 
                                placeholder="Filter collections..." 
                                class="search-input"
                                @click.stop
                            />
                            <button v-if="searchQuery" @click.stop="searchQuery = ''" class="clear-search">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="menu-list custom-scrollbar">
                        <!-- Default Option (Only show if no search or matches 'default') -->
                        <button 
                            v-if="!searchQuery || 'default'.includes(searchQuery.toLowerCase())"
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

                        <div v-if="!searchQuery" class="divider"></div>

                        <!-- Render dynamic options manually to avoid v-for issues in debug -->
                        <template v-if="filteredCollections.length > 0">
                             <button 
                                v-for="col in filteredCollections" 
                                :key="col._id"
                                @click="selectCollection(col._id)"
                                class="menu-item"
                                :class="{ 'selected': chatStore.currentCollectionId === col._id }"
                            >
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
                        </template>
                        <div v-else-if="searchQuery" class="p-4 text-xs text-center text-gray-500">
                             No collections match "{{ searchQuery }}"
                        </div>
                        <div v-else-if="!knowledgeStore.collections || knowledgeStore.collections.length === 0" class="p-2 text-xs text-center text-gray-500">
                             No collections loaded
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.knowledge-selector {
    position: relative;
}

.selector-trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px 6px 6px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 9999px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    min-width: 180px;
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
    font-size: 14px;
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

/* Overlay Container */
.overlay-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2147483647; /* Max z-index */
    pointer-events: none; /* Let clicks pass through empty areas but not backdrop */
}

.backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.05); /* Slight dim to prove visibility */
    pointer-events: auto;
}

/* Dropdown Menu */
.dropdown-menu {
    position: fixed;
    width: 320px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    transform-origin: top left;
    pointer-events: auto;
    /* Ensure content is visible against any background */
    background-color: var(--color-bg-primary, #ffffff); 
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

/* Search Styles */
.search-container {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
}

.search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.search-icon {
    position: absolute;
    left: 10px;
    color: var(--color-text-muted);
    pointer-events: none;
}

.search-input {
    width: 100%;
    padding: 8px 32px 8px 32px;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    color: var(--color-text-primary);
    outline: none;
    transition: all 0.2s;
}

.search-input:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-light);
}

.clear-search {
    position: absolute;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 50%;
}

.clear-search:hover {
    background: var(--color-bg-active);
    color: var(--color-text-primary);
}

.menu-list {
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

.default-icon { background: rgba(34, 197, 94, 0.1); color: var(--color-success); }
.personal-icon { background: rgba(59, 130, 246, 0.1); color: var(--color-accent); }
.dept-icon { background: rgba(245, 158, 11, 0.1); color: var(--color-warning); }
.public-icon { background: rgba(100, 116, 139, 0.1); color: var(--color-text-secondary); }

.item-content { flex: 1; min-width: 0; }
.item-title { display: block; font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
.item-desc { display: block; font-size: 12px; color: var(--color-text-secondary); margin-top: 1px; }

.check-icon {
    color: var(--color-accent);
}

.divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 10px;
}

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }

@media (max-width: 768px) {
    .dropdown-menu {
        width: 90%;
        max-width: 320px;
        left: 50% !important;
        transform: translateX(-50%) !important;
    }
}
</style>
