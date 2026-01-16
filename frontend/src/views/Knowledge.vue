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
      <div class="content-scroll-area p-6 md:p-10">
        <div class="max-w-5xl mx-auto">
            
          <!-- Header Section -->
          <div class="mb-10 flex justify-between items-end border-b border-gray-800 pb-6">
            <div>
              <h1 class="text-3xl font-bold text-white mb-2">Knowledge Base</h1>
              <p class="text-gray-400">Manage your AI's context documents. Upload PDFs or text files to enhance responses.</p>
            </div>
            <div class="text-right hidden sm:block">
              <div class="text-2xl font-bold text-blue-400">{{ documents.length }}</div>
              <div class="text-sm text-gray-500 uppercase tracking-wider">Documents</div>
            </div>
          </div>

          <!-- Main Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <!-- Left Column: Upload -->
            <div class="lg:col-span-1">
              <div 
                class="upload-card bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-center transition-all duration-300 relative overflow-hidden group"
                :class="{ 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-800': isDragging, 'hover:border-blue-400/50': !isDragging }"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <input type="file" ref="fileInput" @change="handleFileSelect" class="hidden" accept=".pdf,.txt" />
                
                <div v-if="uploading" class="py-12">
                   <div class="relative w-16 h-16 mx-auto mb-4">
                      <div class="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
                      <div class="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                   </div>
                   <p class="text-blue-400 font-medium">Embedding Document...</p>
                   <p class="text-xs text-gray-500 mt-2">This may take a moment</p>
                </div>

                <div v-else class="py-8">
                  <div class="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="text-blue-400">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  
                  <h3 class="text-lg font-semibold text-white mb-2">Upload New File</h3>
                  <p class="text-sm text-gray-400 mb-6 px-4">Drag & drop PDF or TXT files here, or click to browse.</p>
                  
                  <button 
                    @click="$refs.fileInput.click()" 
                    class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition shadow-lg shadow-blue-900/20 active:scale-95"
                  >
                    Select File
                  </button>
                </div>
              </div>

               <!-- Tips Card -->
              <div class="mt-6 bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
                <h4 class="font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <span class="text-blue-400">💡</span> Tips
                </h4>
                <ul class="text-sm text-gray-400 space-y-2 list-disc list-inside">
                  <li>Use clear, readable PDFs.</li>
                  <li>Max file size: 50MB.</li>
                  <li>Text-based PDFs work best.</li>
                  <li>Thai language is supported.</li>
                </ul>
              </div>
            </div>

            <!-- Right Column: List -->
            <div class="lg:col-span-2">
              <div class="bg-slate-800/20 border border-slate-700/50 rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
                <div class="p-4 border-b border-gray-700/50 bg-slate-800/40 flex justify-between items-center">
                  <h3 class="font-semibold text-gray-200 pl-2">Indexed Documents</h3>
                  <!-- Future: Search Input could go here -->
                </div>
                
                <div v-if="documents.length === 0" class="flex-1 flex flex-col items-center justify-center text-gray-500 p-10">
                  <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-3xl opacity-50">📂</div>
                  <p>No documents found.</p>
                  <p class="text-sm mt-1">Upload a document to start building your knowledge base.</p>
                </div>

                <div v-else class="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                  <div 
                    v-for="doc in documents" 
                    :key="doc.name"
                    class="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between hover:border-blue-500/30 hover:bg-slate-700/50 transition group"
                  >
                    <div class="flex items-center gap-4 min-w-0">
                      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-gray-300 font-bold text-xs shadow-inner flex-shrink-0">
                        {{ getExt(doc.name) }}
                      </div>
                      <div class="min-w-0">
                        <h4 class="font-medium text-gray-200 group-hover:text-blue-400 transition-colors truncate pr-4" :title="doc.name">
                          {{ doc.name }}
                        </h4>
                        <div class="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span class="flex items-center gap-1">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                             {{ doc.chunks }} chunks
                          </span>
                          <span class="w-1 h-1 bg-gray-600 rounded-full"></span>
                          <span>{{ new Date(doc.timestamp).toLocaleDateString() }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div class="flex items-center gap-3 pl-4">
                       <span class="text-xs font-medium px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 whitespace-nowrap">
                         Active
                       </span>
                       <!-- Future: Delete button -->
                    </div>
                  </div>
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
