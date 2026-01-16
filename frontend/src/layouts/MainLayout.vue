<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { 
  MessageSquare, 
  Database, 
  Settings, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const isSidebarOpen = ref(true)
const isMobileMenuOpen = ref(false)

const navigation = computed(() => {
  const nav = [
    { name: 'Chat', to: '/chat', icon: MessageSquare },
    { name: 'Knowledge Base', to: '/knowledge-base', icon: Database },
  ]

  if (authStore.user?.role === 'SuperAdmin') {
    nav.push({ name: 'Admin', to: '/admin', icon: Settings })
  }

  return nav
})

const toggleSidebar = () => isSidebarOpen.value = !isSidebarOpen.value

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex">
    <!-- Mobile Menu Overlay -->
    <div 
      v-if="isMobileMenuOpen" 
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      @click="isMobileMenuOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside 
      class="fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col"
      :class="[
        isSidebarOpen ? 'w-64' : 'w-20',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <!-- Logo -->
      <div class="h-16 flex items-center justify-between px-4 border-b border-gray-100">
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
            <span class="text-white font-bold text-lg">M</span>
          </div>
          <span 
            v-if="isSidebarOpen" 
            class="font-bold text-gray-800 text-lg whitespace-nowrap transition-opacity duration-300"
          >
            MFULearnAi
          </span>
        </div>
        <button 
          @click="isMobileMenuOpen = false" 
          class="lg:hidden text-gray-500"
        >
          <X class="w-6 h-6" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-6 px-3 space-y-1">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative"
          :class="[
            route.path.startsWith(item.to) 
              ? 'bg-blue-50 text-blue-600' 
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          ]"
        >
          <component 
            :is="item.icon" 
            class="w-5 h-5 shrink-0 transition-colors"
            :class="route.path.startsWith(item.to) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'"
          />
          <span 
            v-if="isSidebarOpen"
            class="font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
          >
            {{ item.name }}
          </span>
          
          <!-- Tooltip for collapsed state -->
          <div 
            v-if="!isSidebarOpen"
            class="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap"
          >
            {{ item.name }}
          </div>
        </RouterLink>
      </nav>

      <!-- User Profile -->
      <div class="p-4 border-t border-gray-100">
        <div 
          class="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-gray-50 cursor-pointer"
          :class="!isSidebarOpen && 'justify-center'"
        >
          <img 
            :src="authStore.user?.avatar || 'https://ui-avatars.com/api/?name=User'" 
            class="w-9 h-9 rounded-full bg-gray-200 shrink-0"
            alt="User"
          >
          <div v-if="isSidebarOpen" class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">{{ authStore.user?.name }}</p>
            <p class="text-xs text-gray-500 truncate">{{ authStore.user?.role }}</p>
          </div>
          <button 
            v-if="isSidebarOpen"
            @click.stop="handleLogout"
            class="text-gray-400 hover:text-red-500 transition-colors p-1"
            title="Logout"
          >
            <LogOut class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Top Bar (Mobile) & Collapse Toggle -->
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
        <div class="flex items-center gap-4">
          <button 
            @click="isMobileMenuOpen = true"
            class="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu class="w-6 h-6" />
          </button>
          
          <button 
            @click="toggleSidebar"
            class="hidden lg:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div class="transition-transform duration-300" :class="!isSidebarOpen && 'rotate-180'">
               <!-- Simple arrow icon for toggle -->
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </div>
          </button>

          <h2 class="text-lg font-semibold text-gray-800">
             <!-- Dynamic Title based on Route could go here -->
             {{ (route.name?.toString() || '').charAt(0).toUpperCase() + (route.name?.toString() || '').slice(1) }}
          </h2>
        </div>
      </header>

      <!-- Page Content -->
      <div class="flex-1 overflow-auto p-4 lg:p-6">
        <slot></slot>
      </div>
    </main>
  </div>
</template>
