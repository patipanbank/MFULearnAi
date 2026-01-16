<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useTheme, useLanguage } from '@/composables/useSettings';
import { ChatSidebar, ChatHeader } from '@/components/chat';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const chatStore = useChatStore();
const { isDark, toggle: toggleTheme, init: initTheme } = useTheme();
const { lang, toggle: toggleLang, t, init: initLang } = useLanguage();

const collectionId = route.params.id;
const collection = ref(null);
const documents = ref([]);
const isDragging = ref(false);
const uploading = ref(false);
const fileInput = ref(null);
const showSidebar = ref(true);

const userInitial = computed(() => authStore.displayName?.charAt(0)?.toUpperCase() || 'U');
const userName = computed(() => authStore.displayName || 'Guest');
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI';

const fetchCollectionDetails = async () => {
const availableKnowledge = ref([]); // For mapping modal
const showMapModal = ref(false);
const isLoading = ref(true);
const isMapping = ref(false);

// Computed
const canManage = computed(() => {
    if (!collection.value) return false;
    // Simple check: Admin or Owner
    return authStore.user?.role === 'admin' || collection.value.ownerId === authStore.user?.userId;
});

const unmappedKnowledge = computed(() => {
    if (!collection.value) return [];
    const mappedIds = collection.value.knowledgeIds.map(k => k._id);
    return availableKnowledge.value.filter(k => !mappedIds.includes(k._id));
});

// Fetch Data
const fetchCollection = async () => {
    try {
        const res = await axios.get(`/api/knowledge/collections/${route.params.id}`);
        collection.value = res.data.collection;
    } catch (e) {
        console.error('Fetch error:', e);
        if (e.response?.status === 403) alert('Access Denied');
        if (e.response?.status === 404) alert('Collection not found');
        router.push('/knowledge');
    } finally {
        isLoading.value = false;
    }
};

const fetchAvailableKnowledge = async () => {
    try {
        const res = await axios.get('/api/knowledge'); 
        availableKnowledge.value = res.data.knowledge;
    } catch (e) {
        console.error(e);
    }
};

// Actions
const mapKnowledge = async (knowledgeId) => {
    isMapping.value = true;
    try {
        await axios.post(`/api/knowledge/collections/${route.params.id}/map`, {
            knowledgeId,
            action: 'add'
        });
        showMapModal.value = false;
        fetchCollection(); // Refresh list
    } catch (e) {
        alert('Failed to map: ' + (e.response?.data?.error || e.message));
    } finally {
        isMapping.value = false;
    }
};

const unmapKnowledge = async (knowledgeId) => {
    if (!confirm('Remove this knowledge from the collection? (The knowledge asset itself will NOT be deleted)')) return;
    try {
        await axios.post(`/api/knowledge/collections/${route.params.id}/map`, {
            knowledgeId,
            action: 'remove'
        });
        fetchCollection();
    } catch (e) {
        alert('Failed to remove: ' + (e.response?.data?.error || e.message));
    }
};

onMounted(() => {
    fetchCollection();
});
</script>

<template>
    <main class="chat-main bg-slate-900 text-gray-100">
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

      <div class="content-scroll-area p-6 md:p-10">
        <div class="max-w-5xl mx-auto">
            
          <!-- Back & Header -->
          <div class="mb-8">
            <button @click="$router.push('/knowledge')" class="text-blue-400 hover:text-blue-300 text-sm mb-4 flex items-center gap-1">
              ← Back to Library
            </button>
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {{ collection?.name?.charAt(0) || 'C' }}
                </div>
                <div>
                    <h1 class="text-2xl font-bold text-white">{{ collection?.name || 'Loading...' }}</h1>
                    <p class="text-gray-400 text-sm">{{ collection?.description || 'Manage documents in this collection.' }}</p>
                </div>
            </div>
          </div>

          <!-- Upload & List Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <!-- Upload Column -->
            <div class="lg:col-span-1">
              <div 
                class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-center transition-all duration-300 relative overflow-hidden group"
                :class="{ 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-800': isDragging, 'hover:border-blue-400/50': !isDragging }"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <input type="file" ref="fileInput" @change="handleFileSelect" class="hidden" accept=".pdf,.txt" />
                
                <div v-if="uploading" class="py-12">
                   <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                   <p class="text-blue-400 font-medium">Embedding...</p>
                </div>

                <div v-else class="py-8">
                  <div class="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <h3 class="font-semibold text-white mb-2">Add Document</h3>
                  <p class="text-xs text-gray-400 mb-6">PDF or TXT</p>
                  <button @click="$refs.fileInput.click()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-900/20">Select File</button>
                </div>
              </div>
            </div>

            <!-- List Column -->
            <div class="lg:col-span-2">
              <div class="bg-slate-800/20 border border-slate-700/50 rounded-2xl overflow-hidden min-h-[400px] flex flex-col">
                <div class="p-4 border-b border-gray-700/50 bg-slate-800/40">
                  <h3 class="font-semibold text-gray-200">Documents ({{ documents.length }})</h3>
                </div>
                
                <div v-if="documents.length === 0" class="flex-1 flex flex-col items-center justify-center text-gray-500 p-10">
                  <p>No documents yet.</p>
                </div>

                <div v-else class="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                  <div v-for="doc in documents" :key="doc.name" class="bg-slate-800 border border-slate-700 p-3 rounded-xl flex items-center justify-between hover:bg-slate-700/50 transition">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-gray-300 text-xs font-bold">{{ getExt(doc.name) }}</div>
                      <div class="min-w-0">
                        <h4 class="font-medium text-gray-200 truncate" :title="doc.name">{{ doc.name }}</h4>
                        <div class="text-xs text-gray-500">{{ doc.chunks }} chunks • {{ new Date(doc.timestamp).toLocaleDateString() }}</div>
                      </div>
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
.chat-layout { display: flex; height: 100vh; background: var(--color-bg-primary); overflow: hidden; }
.chat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }
.content-scroll-area { flex: 1; overflow-y: auto; scroll-behavior: smooth; }
</style>
