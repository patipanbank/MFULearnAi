<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useTheme, useLanguage } from '@/composables/useSettings';
import { ChatSidebar, ChatHeader } from '@/components/chat';

// Stores & Router
const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();

// Settings
const { isDark, toggle: toggleTheme, init: initTheme } = useTheme();
const { lang, toggle: toggleLang, t, init: initLang } = useLanguage();

// State
const documents = ref([]);
const isDragging = ref(false);
const uploading = ref(false);
const fileInput = ref(null);
const showSidebar = ref(true);

// Computed
const userInitial = computed(() => authStore.displayName?.charAt(0)?.toUpperCase() || 'U');
const userName = computed(() => authStore.displayName || 'Guest');
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI';

// Fetch Documents
const fetchDocuments = async () => {
    try {
        const res = await axios.get('/api/knowledge/documents');
        documents.value = res.data.documents;
    } catch (err) {
        console.error('Failed to load documents', err);
    }
};

// Upload Logic
const uploadFile = async (file) => {
    if (!file) return;
    
    uploading.value = true;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        await axios.post('/api/knowledge/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        await fetchDocuments();
    } catch (err) {
        console.error('Upload failed', err);
        alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
        uploading.value = false;
        isDragging.value = false;
    }
};

const handleFileSelect = (e) => {
    const file = e.target.files[0];
    uploadFile(file);
    e.target.value = '';
};

const handleDrop = (e) => {
    isDragging.value = false;
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.type === 'text/plain')) {
        uploadFile(file);
    }
};

const getExt = (name) => name.split('.').pop().toUpperCase();

// Navigation Handlers (from Sidebar)
const handleNewChat = () => {
    chatStore.newSession();
    router.push('/chat');
};

const handleSelectSession = (sessionId) => {
    chatStore.loadSession(sessionId);
    router.push('/chat');
};

const handleLogout = () => {
    authStore.logout();
    router.push('/login');
};

// Lifecycle
onMounted(() => {
    initTheme();
    initLang();
    fetchDocuments();
    
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }
    
    // Ensure sessions are loaded for the sidebar
    if (chatStore.sessions.length === 0) {
        chatStore.loadSessions();
    }
});
</script>

<template>
  <div class="chat-layout">
    <!-- Sidebar -->
    <ChatSidebar
      v-model="showSidebar"
      :sessions="chatStore.sessions"
      :current-session-id="chatStore.currentSessionId"
      :t="t"
      @new-chat="handleNewChat"
      @select-session="handleSelectSession"
      @toggle-theme="toggleTheme"
      @toggle-lang="toggleLang"
      @logout="handleLogout"
    />

    <!-- Main Content -->
    <main class="chat-main bg-slate-900 text-gray-100">
      <!-- Header -->
      <ChatHeader
        :env-name="envName"
        :user-name="userName"
        :user-initial="userInitial"
        :is-dark="isDark"
        :lang="lang"
        :t="t"
        :show-toggle="true"
        @toggle-sidebar="showSidebar = !showSidebar"
        @toggle-theme="toggleTheme"
        @toggle-lang="toggleLang"
        @logout="handleLogout"
      />

      <!-- Knowledge Content -->
      <div class="content-scroll-area p-8">
        <div class="max-w-4xl mx-auto">
            
          <div class="mb-8">
            <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Knowledge Base
            </h1>
            <p class="text-gray-400 mt-2">Upload and manage documents for AI context.</p>
          </div>

          <!-- Upload Section -->
          <div 
            class="upload-zone mb-8 border-2 border-dashed border-gray-700/50 rounded-xl p-10 text-center transition-all duration-300"
            :class="{ 'border-blue-500 bg-slate-800/50': isDragging, 'hover:border-gray-500': !isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <input type="file" ref="fileInput" @change="handleFileSelect" class="hidden" accept=".pdf,.txt" />
            
            <div v-if="uploading" class="flex flex-col items-center">
              <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
              <p class="text-blue-400">Processing document... (Embedding)</p>
            </div>
            
            <div v-else>
              <div class="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                📄
              </div>
              <h3 class="text-xl font-medium mb-2 text-gray-200">Drag & Drop your files here</h3>
              <p class="text-gray-400 mb-6">Supports PDF and TXT</p>
              <button 
                @click="$refs.fileInput.click()" 
                class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition shadow-lg shadow-blue-900/20 text-white"
              >
                Browse Files
              </button>
            </div>
          </div>

          <!-- Documents List -->
          <div class="documents-list">
            <h2 class="text-xl font-semibold mb-4 text-gray-200">Indexed Documents</h2>
            
            <div v-if="documents.length === 0" class="text-center py-12 text-gray-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700/50">
              No documents found. Upload one to get started.
            </div>

            <div class="grid gap-4">
              <div 
                v-for="doc in documents" 
                :key="doc.name"
                class="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between hover:bg-slate-800/60 transition group"
              >
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-sm">
                    {{ getExt(doc.name) }}
                  </div>
                  <div>
                    <h4 class="font-medium text-gray-200 group-hover:text-blue-400 transition-colors">{{ doc.name }}</h4>
                    <p class="text-xs text-gray-500">
                      {{ doc.chunks }} chunks • {{ new Date(doc.timestamp).toLocaleDateString() }}
                    </p>
                  </div>
                </div>
                
                <div class="flex items-center gap-2">
                   <span class="text-xs px-2.5 py-1 bg-green-500/10 text-green-400 rounded-full border border-green-500/20">Indexed</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  background: var(--color-bg-primary); /* Use var from main.css */
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.content-scroll-area {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}
</style>
