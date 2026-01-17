<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useTheme, useLanguage } from '@/composables/useSettings';
import { ChatSidebar, ChatHeader } from '@/components/chat';
import { 
    FolderIcon, 
    DocumentTextIcon, 
    PlusIcon, 
    MagnifyingGlassIcon,
    FunnelIcon,
    ClockIcon,
    UserIcon,
    BuildingOfficeIcon,
    GlobeAltIcon
} from '@heroicons/vue/24/outline';

const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();
const { isDark, toggle: toggleTheme, init: initTheme } = useTheme();
const { lang, toggle: toggleLang, t, init: initLang } = useLanguage();

// State
const collections = ref([]);
const knowledgeAssets = ref([]);
const isLoading = ref(false);
const activeTab = ref('collections');
const showSidebar = ref(true);
const searchQuery = ref('');
const filterType = ref('all');

// Modals
const showCreateModal = ref(false);
const showUploadModal = ref(false);
const newCollection = ref({ name: '', description: '', type: 'personal' });
const newKnowledge = ref({ file: null, type: 'personal' });
const creating = ref(false);

const userInitial = computed(() => authStore.displayName?.charAt(0)?.toUpperCase() || 'U');
const userName = computed(() => authStore.displayName || 'Guest');
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI';

// Permissions
const canCreateDepartment = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'manager');
const canCreatePublic = computed(() => authStore.user?.role === 'admin');

// Filtered Lists
const filteredCollections = computed(() => {
    return collections.value.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                            c.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
        const matchesType = filterType.value === 'all' || c.type === filterType.value;
        return matchesSearch && matchesType;
    });
});

const filteredKnowledge = computed(() => {
    return knowledgeAssets.value.filter(k => {
        const matchesSearch = k.title.toLowerCase().includes(searchQuery.value.toLowerCase());
        const matchesType = filterType.value === 'all' || k.type === filterType.value;
        return matchesSearch && matchesType;
    });
});

// Fetch Data
const fetchData = async () => {
    isLoading.value = true;
    try {
        const [colRes, knowRes] = await Promise.all([
            axios.get('/api/knowledge/collections'),
            axios.get('/api/knowledge')
        ]);
        collections.value = colRes.data.collections;
        knowledgeAssets.value = knowRes.data.knowledge;
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
        fetchData();
    } catch (e) {
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

// Navigation
const handleNewChat = () => { chatStore.newSession(); router.push('/chat'); };
const handleSelectSession = (id) => { chatStore.loadSession(id); router.push('/chat'); };
const handleLogout = () => { authStore.logout(); router.push('/login'); };

onMounted(() => {
    initTheme();
    initLang();
    if (!authStore.isAuthenticated) { router.push('/login'); return; }
    if (chatStore.sessions.length === 0) chatStore.loadSessions();
    fetchData();
});
</script>

<template>
  <div class="flex h-screen bg-[#0f172a] text-slate-100 font-sans overflow-hidden">
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

    <main class="flex-1 flex flex-col min-w-0 relative">
      <ChatHeader
        :env-name="envName"
        :user-name="userName"
        :user-initial="userInitial"
        :is-dark="isDark"
        :lang="lang"
        :t="t"
        :show-toggle="true"
        class="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30"
        @toggle-sidebar="showSidebar = !showSidebar"
        @toggle-theme="toggleTheme"
        @toggle-lang="toggleLang"
        @logout="handleLogout"
      />

      <!-- Content Scroll Area -->
      <div class="flex-1 overflow-y-auto scroll-smooth">
        
        <!-- Hero Section -->
        <div class="relative bg-gradient-to-b from-blue-900/20 to-transparent pt-12 pb-8 px-6 md:px-12">
            <div class="max-w-7xl mx-auto">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                        <h1 class="text-4xl font-extrabold tracking-tight text-white mb-2 drop-shadow-sm">
                            <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Knowledge</span> Library
                        </h1>
                        <p class="text-slate-400 text-lg max-w-2xl">
                            Manage and organize your AI's intelligence. Create collections, upload documents, and control access permissions.
                        </p>
                    </div>
                    <div class="flex gap-3">
                        <button 
                            @click="showCreateModal = true"
                            class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-900/20 transition-all transform hover:-translate-y-0.5 font-medium"
                        >
                            <PlusIcon class="w-5 h-5" />
                            <span>Collection</span>
                        </button>
                        <button 
                            @click="showUploadModal = true"
                            class="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-900/20 transition-all transform hover:-translate-y-0.5 font-medium"
                        >
                            <PlusIcon class="w-5 h-5" />
                            <span>Upload Asset</span>
                        </button>
                    </div>
                </div>

                <!-- Controls & Filters -->
                <div class="flex flex-col md:flex-row gap-4 p-1.5 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-inner">
                    <!-- Tabs -->
                    <div class="flex p-1 bg-slate-800 rounded-xl">
                        <button 
                            v-for="tab in ['collections', 'knowledge']" 
                            :key="tab"
                            @click="activeTab = tab"
                            class="px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize"
                            :class="activeTab === tab ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'"
                        >
                            {{ tab }}
                        </button>
                    </div>

                    <div class="h-8 w-px bg-slate-700/50 self-center hidden md:block"></div>

                    <!-- Search -->
                    <div class="flex-1 relative group">
                        <MagnifyingGlassIcon class="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-400 transition-colors" />
                        <input 
                            v-model="searchQuery"
                            type="text" 
                            placeholder="Search..." 
                            class="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all placeholder:text-slate-500"
                        >
                    </div>

                    <!-- Filter -->
                     <div class="relative min-w-[140px]">
                        <FunnelIcon class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select 
                            v-model="filterType"
                            class="w-full appearance-none bg-slate-900/50 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-8 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                        >
                            <option value="all">All Types</option>
                            <option value="personal">Personal</option>
                            <option value="department">Department</option>
                            <option value="default">Public</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- Content Grid -->
        <div class="max-w-7xl mx-auto px-6 md:px-12 pb-20">
            <div v-if="isLoading" class="flex justify-center py-20">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>

            <div v-else>
                <!-- Collections Tab -->
                <transition-group 
                    enter-active-class="transition duration-300 ease-out"
                    enter-from-class="transform translate-y-4 opacity-0"
                    enter-to-class="transform translate-y-0 opacity-100"
                    tag="div"
                    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    v-if="activeTab === 'collections'"
                >
                    <div 
                        v-for="col in filteredCollections" 
                        :key="col._id"
                        @click="router.push(`/knowledge/${col._id}`)"
                        class="group bg-slate-800/40 hover:bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 hover:border-blue-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
                    >
                        <div class="flex justify-between items-start mb-4">
                            <div class="p-3.5 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl text-blue-400 group-hover:text-blue-300 group-hover:from-blue-500/20 group-hover:to-indigo-500/20 transition-all">
                                <FolderIcon class="w-8 h-8" />
                            </div>
                            <span class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide border border-current opacity-70"
                                :class="{
                                    'text-purple-400 border-purple-500/30 bg-purple-500/10': col.type === 'personal',
                                    'text-orange-400 border-orange-500/30 bg-orange-500/10': col.type === 'department',
                                    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10': col.type === 'default'
                                }">
                                {{ col.type }}
                            </span>
                        </div>
                        
                        <h3 class="text-xl font-bold text-slate-100 mb-2 truncate group-hover:text-blue-100 transition-colors">{{ col.name }}</h3>
                        <p class="text-slate-400 text-sm line-clamp-2 h-10 mb-6 group-hover:text-slate-300 transition-colors">{{ col.description || 'No description provided.' }}</p>
                        
                        <div class="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-700/50">
                            <div class="flex items-center gap-1.5">
                                <DocumentTextIcon class="w-3.5 h-3.5" />
                                <span>{{ col.knowledgeIds?.length || 0 }} items</span>
                            </div>
                            <span>{{ new Date(col.createdAt).toLocaleDateString() }}</span>
                        </div>
                    </div>
                </transition-group>

                <!-- Knowledge Assets Tab -->
                <transition-group 
                    enter-active-class="transition duration-300 ease-out"
                    enter-from-class="transform translate-y-4 opacity-0"
                    enter-to-class="transform translate-y-0 opacity-100"
                    tag="div"
                    class="space-y-3"
                    v-else
                >
                    <div 
                        v-for="kb in filteredKnowledge" 
                        :key="kb._id" 
                        class="bg-slate-800/40 hover:bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 hover:border-emerald-500/30 rounded-xl p-4 flex items-center gap-5 transition-all hover:translate-x-1"
                    >
                        <div class="p-3 bg-slate-700/50 rounded-lg text-emerald-400">
                            <DocumentTextIcon class="w-6 h-6" />
                        </div>
                        
                        <div class="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <div class="md:col-span-5">
                                <h4 class="font-semibold text-slate-200 truncate mb-1">{{ kb.title }}</h4>
                                <div class="flex items-center gap-2">
                                     <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border border-current opacity-75"
                                        :class="{
                                            'text-purple-400 border-purple-500/30 bg-purple-500/10': kb.type === 'personal',
                                            'text-orange-400 border-orange-500/30 bg-orange-500/10': kb.type === 'department',
                                            'text-blue-400 border-blue-500/30 bg-blue-500/10': kb.type === 'public'
                                        }">
                                        {{ kb.type }}
                                    </span>
                                </div>
                            </div>

                            <div class="hidden md:flex md:col-span-3 items-center gap-2 text-xs text-slate-400">
                                <BuildingOfficeIcon class="w-4 h-4" />
                                <span class="truncate">{{ kb.department || 'General' }}</span>
                            </div>

                            <div class="hidden md:flex md:col-span-2 items-center gap-2 text-xs text-slate-400">
                                <UserIcon class="w-4 h-4" />
                                <span>{{ kb.ownerId === authStore.user?.userId ? 'You' : 'Others' }}</span>
                            </div>

                            <div class="hidden md:flex md:col-span-2 justify-end items-center gap-2 text-xs text-slate-500">
                                <ClockIcon class="w-4 h-4" />
                                <span>{{ new Date(kb.createdAt).toLocaleDateString() }}</span>
                            </div>
                        </div>
                    </div>
                </transition-group>

                <!-- Empty State -->
                <div v-if="(activeTab === 'collections' && filteredCollections.length === 0) || (activeTab === 'knowledge' && filteredKnowledge.length === 0)" 
                     class="flex flex-col items-center justify-center py-20 text-center animate-pulse"
                >
                    <div class="p-6 bg-slate-800/50 rounded-full mb-4">
                        <MagnifyingGlassIcon class="w-12 h-12 text-slate-600" />
                    </div>
                    <h3 class="text-xl font-semibold text-slate-300 mb-2">No items found</h3>
                    <p class="text-slate-500 max-w-sm">Try adjusting your filters or create a new item to get started.</p>
                </div>
            </div>
        </div>
      </div>

      <!-- Create Collection Modal -->
      <transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
        <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div class="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-md p-8 shadow-2xl relative">
                <button @click="showCreateModal = false" class="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">✕</button>
                
                <h2 class="text-2xl font-bold text-white mb-1">New Collection</h2>
                <p class="text-slate-400 text-sm mb-6">Group your knowledge assets together.</p>
                
                <div class="space-y-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Name</label>
                        <input v-model="newCollection.name" type="text" class="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-600" placeholder="e.g. Q1 Reports">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                        <textarea v-model="newCollection.description" class="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-24 placeholder:text-slate-600" placeholder="What's this collection about?"></textarea>
                    </div>
                    <div>
                            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Visibility</label>
                            <div class="grid grid-cols-3 gap-2">
                                <button 
                                    v-for="type in ['personal', 'department', 'default']" 
                                    :key="type"
                                    type="button"
                                    @click="newCollection.type = type"
                                    :disabled="type !== 'personal' && !canCreateDepartment"
                                    class="px-2 py-2 rounded-lg text-xs font-medium border transition-all capitalize"
                                    :class="newCollection.type === type 
                                        ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'"
                                >
                                    {{ type === 'default' ? 'Public' : type }}
                                </button>
                            </div>
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-8">
                    <button @click="showCreateModal = false" class="px-5 py-2.5 text-slate-400 hover:text-white font-medium transition-colors">Cancel</button>
                    <button @click="createCollection" :disabled="creating" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-900/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                        {{ creating ? 'Creating...' : 'Create Collection' }}
                    </button>
                </div>
            </div>
        </div>
      </transition>

      <!-- Upload Modal -->
      <transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
        <div v-if="showUploadModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div class="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-md p-8 shadow-2xl relative">
                <button @click="showUploadModal = false" class="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">✕</button>

                <h2 class="text-2xl font-bold text-white mb-1">Upload Asset</h2>
                <p class="text-slate-400 text-sm mb-6">Add a new document to your knowledge base.</p>

                <div class="space-y-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Scope</label>
                         <select v-model="newKnowledge.type" class="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all cursor-pointer">
                            <option value="personal">Personal (Only Me)</option>
                            <option v-if="canCreateDepartment" value="department">Department (My Dept)</option>
                            <option v-if="canCreatePublic" value="public">Public (Everyone)</option>
                        </select>
                    </div>

                    <div class="relative group cursor-pointer">
                        <input type="file" @change="handleFileUpload" accept=".pdf,.txt" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div class="border-2 border-dashed border-slate-700 group-hover:border-emerald-500/50 rounded-2xl p-8 text-center transition-all bg-slate-800/30 group-hover:bg-slate-800/50">
                            <div v-if="!newKnowledge.file">
                                <DocumentTextIcon class="w-12 h-12 text-slate-600 group-hover:text-emerald-500/80 mx-auto mb-3 transition-colors" />
                                <p class="text-sm text-slate-300 font-medium">Drop file here or click to browse</p>
                                <p class="text-xs text-slate-500 mt-1">PDF or TXT up to 10MB</p>
                            </div>
                            <div v-else class="flex flex-col items-center">
                                <div class="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 mb-2">
                                    <DocumentTextIcon class="w-8 h-8" />
                                </div>
                                <p class="text-sm text-emerald-400 font-medium break-all">{{ newKnowledge.file.name }}</p>
                                <p class="text-xs text-slate-500 mt-1">Click to change</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-8">
                    <button @click="showUploadModal = false" class="px-5 py-2.5 text-slate-400 hover:text-white font-medium transition-colors">Cancel</button>
                    <button @click="uploadKnowledge" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-900/20 transition-all transform hover:-translate-y-0.5">
                        Upload Asset
                    </button>
                </div>
            </div>
        </div>
      </transition>

    </main>
  </div>
</template>

<style scoped>
/* Custom Scrollbar for this component */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #475569; }
</style>

