<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const props = defineProps({
  envName: { type: String, default: 'MFULearnAI' },
  userName: { type: String, default: 'User' },
  userInitial: { type: String, default: 'U' },
  showSidebarToggle: { type: Boolean, default: true }
})

const emit = defineEmits(['toggle-sidebar'])

const route = useRoute()
const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

// Dropdown State
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

const currentCollectionName = computed(() => {
    if (!chatStore.currentCollectionId) return t('defaultCollection')
    const col = knowledgeStore.collections.find(c => c._id === chatStore.currentCollectionId)
    return col ? col.name : t('defaultCollection')
})

const toggleDropdown = () => {
    isDropdownOpen.value = !isDropdownOpen.value
}

const selectCollection = (id) => {
    chatStore.currentCollectionId = id
    isDropdownOpen.value = false
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
        isDropdownOpen.value = false
    }
}

onMounted(() => {
    knowledgeStore.fetchCollections()
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <header class="chat-header">
    <div class="header-left">
      <button v-if="showSidebarToggle" class="btn-menu" @click="emit('toggle-sidebar')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      
      <div class="app-brand">
        <span class="logo-emoji">🤖</span>
        <h1>{{ envName }}</h1>
      </div>
      
        <!-- Modern Knowledge Selector -->
        <div 
            v-if="route.path.includes('/chat') && knowledgeStore.collections.length > 0" 
            class="knowledge-selector ml-4 hidden md:flex items-center gap-3 relative"
            ref="dropdownRef"
        >
            <!-- Trigger Button -->
            <button 
                @click="toggleDropdown"
                class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 transition-all duration-200 group"
            >
                <div class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full" :class="chatStore.currentCollectionId ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'bg-slate-400'"></span>
                    <span class="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {{ currentCollectionName }}
                    </span>
                </div>
                <svg 
                    class="w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-transform duration-200"
                    :class="{ 'rotate-180': isDropdownOpen }"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            <!-- Dropdown Menu -->
            <transition name="fade-slide">
                <div 
                    v-if="isDropdownOpen"
                    class="absolute top-full left-0 mt-2 w-64 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                    <div class="p-2 space-y-1">
                        <!-- Header -->
                        <div class="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {{ t('activeKnowledge') }}
                        </div>

                        <!-- Default Option -->
                        <button 
                            @click="selectCollection(null)"
                            class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group"
                            :class="!chatStore.currentCollectionId ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'"
                        >
                            <span class="flex items-center gap-2">
                                <span class="text-lg">🌐</span>
                                {{ t('defaultCollection') }}
                            </span>
                            <svg v-if="!chatStore.currentCollectionId" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>

                        <div class="h-px bg-slate-700/50 my-1 mx-2"></div>

                        <!-- Collection Options -->
                        <div class="max-h-[300px] overflow-y-auto custom-scrollbar">
                            <button 
                                v-for="col in knowledgeStore.collections" 
                                :key="col._id" 
                                @click="selectCollection(col._id)"
                                class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group"
                                :class="chatStore.currentCollectionId === col._id ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'"
                            >
                                <span class="flex items-center gap-2 truncate">
                                    <span class="text-lg">{{ col.type === 'personal' ? '👤' : (col.type === 'department' ? '🏢' : '📚') }}</span>
                                    <span class="truncate">{{ col.name }}</span>
                                </span>
                                <svg v-if="chatStore.currentCollectionId === col._id" class="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </transition>
        </div>
    </div>
    
    <div class="header-right">
      <div class="user-display">
        <div class="user-avatar">{{ userInitial }}</div>
        <span class="user-name">{{ userName }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.chat-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  z-index: 40; /* Ensure header is above content but below modals */
  position: relative;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-menu {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-menu:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-emoji {
  font-size: 24px;
}

.app-brand h1 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.knowledge-selector {
    padding-left: 16px;
    border-left: 1px solid var(--color-border);
}

.header-right {
  display: flex;
  align-items: center;
}

.user-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  background: var(--color-bg-tertiary);
  border-radius: 50px;
  border: 1px solid var(--color-border);
}

.user-avatar {
  width: 32px;
  height: 32px;
  background: var(--color-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  padding-right: 4px;
}

/* Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 640px) {
  .user-name { display: none; }
  .knowledge-selector { display: none; } /* Hide on mobile for now or find better spot */
}
</style>
