<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useTheme, useLanguage } from '@/composables/useSettings';
import { ChatSidebar, ChatHeader } from '@/components/chat';

const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();
const { isDark, toggle: toggleTheme, init: initTheme } = useTheme();
const { lang, toggle: toggleLang, t, init: initLang } = useLanguage();

const collections = ref([]);
const showSidebar = ref(true);
const showCreateModal = ref(false);

const newCollection = ref({ name: '', description: '', type: 'personal' }); // Modified
const creating = ref(false);

// New reactive variables
const isLoading = ref(false);
const activeTab = ref('collections');
const knowledgeAssets = ref([]);
const showUploadModal = ref(false);
const newKnowledge = ref({ file: null, type: 'personal' });

const userInitial = computed(() => authStore.displayName?.charAt(0)?.toUpperCase() || 'U');
const userName = computed(() => authStore.displayName || 'Guest');
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI';

// Computed properties for permissions
const canCreateDepartment = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'manager');
const canCreatePublic = computed(() => authStore.user?.role === 'admin');

// Fetch Data
const fetchData = async () => {
    isLoading.value = true;
    try {
        if (activeTab.value === 'collections') {
            const res = await axios.get('/api/knowledge/collections');
            collections.value = res.data.collections;
        } else {
            const res = await axios.get('/api/knowledge'); // Gets all visible
            knowledgeAssets.value = res.data.knowledge;
        }
    } catch (e) {
        console.error('Fetch error:', e);
    } finally {
        isLoading.value = false;
    }
};

// Actions
const createCollection = async () => {
    if (!newCollection.value.name) return;
    creating.value = true;
    try {
        await axios.post('/api/knowledge/collections', {
            name: newCollection.value.name,
            description: newCollection.value.description,
            type: newCollection.value.type
        });
        showCreateModal.value = false;
        newCollection.value = { name: '', description: '', type: 'personal' };
        fetchData(); // Changed from fetchCollections
    } catch (e) { // Changed error handling
        alert('Failed to create collection: ' + (e.response?.data?.error || e.message));
    } finally {
        creating.value = false;
    }
};

const handleFileUpload = (event) => {
    newKnowledge.value.file = event.target.files[0];
};

const uploadKnowledge = async () => {
    if (!newKnowledge.value.file) return alert('Please select a file');
    
    const formData = new FormData();
    formData.append('file', newKnowledge.value.file);
    formData.append('type', newKnowledge.value.type);

    try {
        await axios.post('/api/knowledge', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        showUploadModal.value = false;
        newKnowledge.value = { file: null, type: 'personal' };
        fetchData();
    } catch (e) {
        alert('Upload failed: ' + (e.response?.data?.error || e.message));
    }
};

const deleteCollection = async (id) => {
    if (!confirm('Are you sure?')) return;
    try {
        await axios.delete(`/api/knowledge/collections/${id}`);
        fetchData();
    } catch (e) {
        console.error(e);
    }
};

// Navigation
const handleNewChat = () => { chatStore.newSession(); router.push('/chat'); };
const handleSelectSession = (id) => { chatStore.loadSession(id); router.push('/chat'); };
const handleLogout = () => { authStore.logout(); router.push('/login'); };

onMounted(() => {
    initTheme();
    initLang();
    if (!authStore.isAuthenticated) { router.push('/login'); return; }
    if (chatStore.sessions.length === 0) chatStore.loadSessions();
    fetchData(); // Changed from fetchCollections
});
</script>

<template>
  <div class="chat-layout">
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
        <div class="p-6 max-w-7xl mx-auto text-gray-100">
            <!-- Header -->
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Knowledge Library
                    </h1>
                    <p class="text-gray-400 text-sm mt-1">Manage your knowledge assets and collections</p>
                </div>

                <!-- Tabs -->
                <div class="flex bg-slate-800 rounded-lg p-1 gap-1">
                    <button
                        @click="activeTab = 'collections'; fetchData()"
                        class="px-4 py-2 text-sm rounded-md transition-all"
                        :class="activeTab === 'collections' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'"
                    >
                        Collections
                    </button>
                    <button
                        @click="activeTab = 'knowledge'; fetchData()"
                        class="px-4 py-2 text-sm rounded-md transition-all"
                        :class="activeTab === 'knowledge' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'"
                    >
                        Knowledge Assets
                    </button>
                </div>
            </div>

            <!-- Toolbar -->
            <div class="flex justify-end mb-6">
                <button
                    v-if="activeTab === 'collections'"
                    @click="showCreateModal = true"
                    class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <PlusIcon class="w-5 h-5" />
                    New Collection
                </button>
                <button
                    v-else
                    @click="showUploadModal = true"
                    class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <PlusIcon class="w-5 h-5" />
                    Upload Asset
                </button>
            </div>

            <!-- Content Area -->
            <div v-if="isLoading" class="text-center py-12 text-gray-500">Loading...</div>

            <!-- Collections Grid -->
            <div v-else-if="activeTab === 'collections'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                    v-for="col in collections"
                    :key="col._id"
                    @click="router.push(`/knowledge/${col._id}`)"
                    class="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer group"
                >
                    <div class="flex justify-between items-start mb-4">
                        <div class="p-3 bg-slate-700/50 rounded-lg text-blue-400 group-hover:text-blue-300 group-hover:bg-blue-500/20 transition-colors">
                            <FolderIcon class="w-8 h-8" />
                        </div>
                         <!-- Type Badge -->
                         <span class="px-2 py-1 rounded text-xs font-mono uppercase"
                            :class="{
                                'bg-purple-900/50 text-purple-400': col.type === 'personal',
                                'bg-orange-900/50 text-orange-400': col.type === 'department',
                                'bg-green-900/50 text-green-400': col.type === 'default'
                            }">
                            {{ col.type }}
                         </span>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-200 mb-2 truncate">{{ col.name }}</h3>
                    <p class="text-sm text-gray-400 line-clamp-2 h-10">{{ col.description || 'No description' }}</p>
                    <div class="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center text-xs text-gray-500">
                        <span>{{ col.knowledgeIds?.length || 0 }} items</span>
                        <span>Created {{ new Date(col.createdAt).toLocaleDateString() }}</span>
                    </div>
                </div>
            </div>

            <!-- Knowledge List -->
            <div v-else class="space-y-4">
                <div v-for="kb in knowledgeAssets" :key="kb._id" class="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center gap-4 hover:border-slate-600 transition-colors">
                    <div class="p-2 bg-slate-700 rounded text-emerald-400">
                        <DocumentTextIcon class="w-6 h-6" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <h4 class="font-medium text-gray-200 truncate">{{ kb.title }}</h4>
                            <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider"
                                 :class="{
                                    'bg-purple-900/30 text-purple-400': kb.type === 'personal',
                                    'bg-orange-900/30 text-orange-400': kb.type === 'department',
                                    'bg-blue-900/30 text-blue-400': kb.type === 'public'
                                }">
                                {{ kb.type }}
                            </span>
                        </div>
                        <div class="flex items-center gap-4 text-xs text-gray-400">
                            <span>Owner: {{ kb.ownerId === authStore.user?.userId ? 'Me' : 'Others' }}</span>
                            <span>Dept: {{ kb.department }}</span>
                            <span>{{ new Date(kb.createdAt).toLocaleDateString() }}</span>
                        </div>
                    </div>
                </div>
                <div v-if="knowledgeAssets.length === 0" class="text-center py-12 text-gray-500 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                    No knowledge assets found. Upload one to get started.
                </div>
            </div>

            <!-- Create Collection Modal -->
            <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div class="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                    <h2 class="text-xl font-bold text-white mb-6">New Collection</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-400 mb-1">Name</label>
                            <input v-model="newCollection.name" type="text" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-400 mb-1">Description</label>
                            <textarea v-model="newCollection.description" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 h-24"></textarea>
                        </div>
                        <div>
                             <label class="block text-sm font-medium text-gray-400 mb-1">Type</label>
                             <select v-model="newCollection.type" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500">
                                 <option value="personal">Personal (Private)</option>
                                 <option v-if="canCreateDepartment" value="department">Department (Shared)</option>
                                 <option v-if="canCreateDepartment" value="default">Default (Public/Global)</option>
                             </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-8">
                        <button @click="showCreateModal = false" class="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                        <button @click="createCollection" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">Create</button>
                    </div>
                </div>
            </div>

             <!-- Upload Knowledge Modal -->
             <div v-if="showUploadModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div class="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                    <h2 class="text-xl font-bold text-white mb-6">Upload Knowledge Asset</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-400 mb-1">Scope</label>
                            <select v-model="newKnowledge.type" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500">
                                <option value="personal">Personal (Only Me)</option>
                                <option v-if="canCreateDepartment" value="department">Department (My Dept)</option>
                                <option v-if="canCreatePublic" value="public">Public (Everyone)</option>
                            </select>
                             <p class="text-xs text-gray-500 mt-1">
                                {{ newKnowledge.type === 'personal' ? 'Visible only to you.' :
                                   newKnowledge.type === 'department' ? 'Visible to ' + authStore.user?.department :
                                   'Visible to everyone.' }}
                            </p>
                        </div>

                        <div class="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-emerald-500/50 transition-colors">
                            <input type="file" @change="handleFileUpload" accept=".pdf,.txt" class="hidden" id="fileInput">
                            <label for="fileInput" class="cursor-pointer">
                                <DocumentTextIcon class="w-12 h-12 text-slate-600 mx-auto mb-2" />
                                <p class="text-sm text-gray-400" v-if="!newKnowledge.file">Click to select PDF or TXT</p>
                                <p class="text-sm text-emerald-400 font-medium" v-else>{{ newKnowledge.file.name }}</p>
                            </label>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-8">
                        <button @click="showUploadModal = false" class="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                        <button @click="uploadKnowledge" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium">Upload</button>
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
