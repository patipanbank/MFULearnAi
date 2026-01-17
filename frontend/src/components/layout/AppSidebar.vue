<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  ChatBubbleLeftRightIcon, 
  BookOpenIcon, 
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon
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
  { name: 'Chat', href: '/chat', icon: ChatBubbleLeftRightIcon },
  { name: 'Knowledge', href: '/knowledge', icon: BookOpenIcon },
  { name: 'Admin', href: '/admin', icon: Cog6ToothIcon, auth: 'admin' }, // Example admin route
]

const toggleSidebar = () => {
    isCollapsed.value = !isCollapsed.value
}

const handleLogout = () => {
    authStore.logout()
    router.push('/login')
}

const currentRouteName = computed(() => route.path)

</script>

<template>
  <!-- Mobile Backdrop -->
  <div 
    v-if="isMobileOpen" 
    class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden"
    @click="isMobileOpen = false"
  ></div>

  <!-- Sidebar Container -->
  <aside 
    class="fixed lg:static top-0 left-0 z-50 h-screen transition-all duration-300 ease-in-out bg-slate-900 border-r border-slate-800 flex flex-col"
    :class="[
      isCollapsed ? 'w-20' : 'w-64',
      isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      'lg:translate-x-0' 
    ]"
  >
    <!-- Header / Logo -->
    <div class="h-16 flex items-center justify-center border-b border-slate-800 relative">
        <div class="flex items-center gap-2 font-bold text-white tracking-wider" :class="{ 'px-4 w-full': !isCollapsed }">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shrink-0">
                <span class="text-white text-lg">M</span>
            </div>
            <span v-if="!isCollapsed" class="truncate transition-opacity duration-300">MFULearnAI</span>
        </div>
        
        <!-- Collapse Toggle (Desktop) -->
        <button 
            @click="toggleSidebar"
            class="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
            <svg v-if="isCollapsed" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
    </div>

    <!-- Navigation Items -->
    <nav class="flex-1 overflow-y-auto py-6 px-3 space-y-2">
        <template v-for="item in navigation" :key="item.name">
            <router-link 
                v-if="!item.auth || authStore.user?.role === item.auth"
                :to="item.href"
                class="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative"
                :class="[
                    currentRouteName.startsWith(item.href) 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                ]"
                :title="isCollapsed ? item.name : ''"
            >
                <component :is="item.icon" class="w-6 h-6 shrink-0" />
                <span 
                    v-if="!isCollapsed" 
                    class="font-medium whitespace-nowrap overflow-hidden transition-all duration-300 origin-left"
                >
                    {{ item.name }}
                </span>
                
                <!-- Tooltip for collapsed state -->
                <div v-if="isCollapsed" class="fixed left-20 ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                    {{ item.name }}
                </div>
            </router-link>
        </template>
    </nav>

    <!-- Bottom Actions -->
    <div class="p-3 border-t border-slate-800 space-y-2">
        <!-- Theme Toggle (Simplified) -->
        <button 
            @click="toggleTheme" 
            class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all group"
            :title="isCollapsed ? (isDark ? 'Light Mode' : 'Dark Mode') : ''"
        >
            <svg v-if="isDark" class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            <svg v-else class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            <span v-if="!isCollapsed" class="font-medium">Theme</span>
        </button>

        <!-- Logout -->
        <button 
            @click="handleLogout" 
            class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all group"
            :title="isCollapsed ? 'Logout' : ''"
        >
            <ArrowLeftOnRectangleIcon class="w-6 h-6 shrink-0" />
            <span v-if="!isCollapsed" class="font-medium">Logout</span>
        </button>
    </div>
  </aside>

  <!-- Mobile Trigger (When sidebar is hidden) -->
  <button 
    v-if="!isMobileOpen"
    @click="isMobileOpen = true" 
    class="fixed bottom-4 right-4 lg:hidden z-30 p-3 bg-blue-600 rounded-full text-white shadow-lg"
  >
    <Bars3Icon class="w-6 h-6" />
  </button>

</template>
