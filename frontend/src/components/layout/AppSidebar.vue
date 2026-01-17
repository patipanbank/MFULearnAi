<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  ChatBubbleLeftRightIcon, 
  BookOpenIcon, 
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  CpuChipIcon
} from '@heroicons/vue/24/outline'

import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useSettings'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isDark, toggle: toggleTheme } = useTheme()

const isCollapsed = ref(true) // Default collapsed on desktop
const isMobileOpen = ref(false)

const navigation = [
  { name: 'AI Chat', href: '/chat', icon: ChatBubbleLeftRightIcon },
  { name: 'Knowledge', href: '/knowledge', icon: BookOpenIcon },
  // { name: 'Admin', href: '/admin', icon: CpuChipIcon, auth: 'admin' }, 
]

const toggleSidebar = () => isCollapsed.value = !isCollapsed.value
const closeMobileMenu = () => isMobileOpen.value = false

const handleLogout = () => {
    authStore.logout()
    router.push('/login')
}

// Check active state loosely (starts with) or exact
const isActive = (href) => route.path.startsWith(href)

</script>

<template>
  <!-- Mobile Backdrop -->
  <Transition
    enter-active-class="transition-opacity duration-300 ease-linear"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-300 ease-linear"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div 
        v-if="isMobileOpen" 
        class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden"
        @click="closeMobileMenu"
    ></div>
  </Transition>

  <!-- Sidebar Container -->
  <aside 
    class="fixed lg:static top-0 left-0 z-50 h-screen transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col bg-[#0b1121] border-r border-slate-800"
    :class="[
      isCollapsed ? 'lg:w-20' : 'lg:w-64',
      isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
    ]"
  >
    <!-- Header -->
    <div class="h-18 flex items-center justify-between px-4 py-5 mb-2 relative shrink-0">
        <div class="flex items-center gap-3 overflow-hidden">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/20 shrink-0">
               <span class="text-white font-bold text-xl">M</span>
            </div>
            <div class="flex flex-col transition-opacity duration-300" :class="{ 'opacity-0 lg:hidden': isCollapsed && !isMobileOpen }">
                <span class="font-bold text-slate-100 tracking-tight whitespace-nowrap">MFULearn AI</span>
                <span class="text-[10px] text-blue-400 uppercase tracking-widest font-semibold">Enterprise</span>
            </div>
        </div>
        
        <!-- Mobile Close -->
        <button @click="closeMobileMenu" class="lg:hidden p-1 text-slate-400 hover:text-white">
            <XMarkIcon class="w-6 h-6" />
        </button>
    </div>

    <!-- Toggle Button (Desktop Absolute) -->
    <button 
        @click="toggleSidebar"
        class="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-all shadow-md z-50 transform"
        :class="isCollapsed ? 'rotate-180' : 'rotate-0'"
    >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
    </button>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 space-y-1 py-4">
        <template v-for="item in navigation" :key="item.name">
            <router-link 
                v-if="!item.auth || authStore.user?.role === item.auth"
                :to="item.href"
                @click="closeMobileMenu"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative"
                :class="[
                    isActive(item.href)
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                ]"
            >
                <component :is="item.icon" class="w-5 h-5 shrink-0 transition-transform duration-300" :class="isActive(item.href) ? 'scale-110' : ''" />
                
                <span 
                    class="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
                    :class="[ isCollapsed && !isMobileOpen ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100' ]"
                >
                    {{ item.name }}
                </span>

                <!-- Tooltip (Collapsed) -->
                <div v-if="isCollapsed && !isMobileOpen" class="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-900 text-slate-200 text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-xl border border-slate-700/50 whitespace-nowrap z-50 translate-x-[-8px] group-hover:translate-x-0">
                    {{ item.name }}
                </div>
            </router-link>
        </template>
    </nav>

    <!-- Footer Actions -->
    <div class="p-3 border-t border-slate-800/50 space-y-1 bg-[#0b1121]">
        <!-- Theme Toggle -->
        <button 
            @click="toggleTheme" 
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-white transition-all group relative"
        >
            <svg v-if="isDark" class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            <svg v-else class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            
            <span 
                 class="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
                 :class="[ isCollapsed && !isMobileOpen ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100' ]"
            >
                {{ isDark ? 'Light Mode' : 'Dark Mode' }}
            </span>

             <!-- Tooltip (Collapsed) -->
             <div v-if="isCollapsed && !isMobileOpen" class="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-900 text-slate-200 text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-xl border border-slate-700/50 whitespace-nowrap z-50">
                Theme
            </div>
        </button>

        <!-- Logout -->
        <button 
            @click="handleLogout" 
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all group relative"
        >
            <ArrowLeftOnRectangleIcon class="w-5 h-5 shrink-0" />
             <span 
                 class="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
                 :class="[ isCollapsed && !isMobileOpen ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100' ]"
            >
                Sign Out
            </span>

            <!-- Tooltip (Collapsed) -->
             <div v-if="isCollapsed && !isMobileOpen" class="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-900 text-slate-200 text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-xl border border-slate-700/50 whitespace-nowrap z-50">
                Sign Out
            </div>
        </button>
    </div>
  </aside>

  <!-- Mobile Trigger Button (Fixed Bottom-Right) -->
  <button 
    v-show="!isMobileOpen"
    @click="isMobileOpen = true" 
    class="fixed bottom-6 right-6 lg:hidden z-30 p-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-full shadow-2xl shadow-blue-600/40 transition-all hover:scale-105 active:scale-95"
  >
    <Bars3Icon class="w-6 h-6" />
  </button>
</template>

<style scoped>
/* Force SVG icons to respect their defined dimensions */
nav :deep(svg),
.p-3 :deep(svg) {
  width: 1.25rem !important;  /* 20px = w-5 */
  height: 1.25rem !important; /* 20px = h-5 */
  min-width: 1.25rem;
  min-height: 1.25rem;
  max-width: 1.25rem;
  max-height: 1.25rem;
  flex-shrink: 0;
}
</style>
