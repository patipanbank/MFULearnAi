<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { 
    ArrowLeftIcon, 
    DocumentTextIcon, 
    TrashIcon, 
    PlusIcon, 
    LinkIcon,
    CalendarIcon,
    UserIcon,
    BuildingOfficeIcon
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const collection = ref(null);
const availableKnowledge = ref([]); // For mapping modal
const showMapModal = ref(false);
const isLoading = ref(true);
const isMapping = ref(false);
const searchQuery = ref('');

// Computed
const canManage = computed(() => {
    if (!collection.value) return false;
    // Simple check: Admin or Owner
    return authStore.user?.role === 'admin' || collection.value.ownerId === authStore.user?.userId;
});

const unmappedKnowledge = computed(() => {
    if (!collection.value) return [];
    // knowledgeIds is an array of objects populated by backend
    const mappedIds = collection.value.knowledgeIds.map(k => k._id);
    const available = availableKnowledge.value.filter(k => !mappedIds.includes(k._id));
    
    if (!searchQuery.value) return available;
    
    return available.filter(k => 
        k.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        k.department?.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
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
    <div class="h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans overflow-hidden">
        
        <!-- Header / Nav -->
        <div class="p-6 md:px-12 pt-8 flex-none z-10">
            <button @click="router.push('/knowledge')" class="group flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors font-medium">
                <div class="p-1.5 rounded-full bg-slate-800 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ArrowLeftIcon class="w-4 h-4" /> 
                </div>
                <span>Back to Library</span>
            </button>
        </div>

        <div v-if="isLoading" class="flex-1 flex justify-center items-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
        
        <div v-else-if="collection" class="flex-1 overflow-y-auto scroll-smooth px-6 md:px-12 pb-12">
            <div class="max-w-6xl mx-auto">
                
                <!-- Hero Section -->
                <div class="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-3xl p-8 md:p-10 mb-10 overflow-hidden shadow-2xl">
                    <!-- Decorate Background -->
                    <div class="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transform translate-x-12 -translate-y-12">
                        <svg class="w-96 h-96 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>
                    </div>

                    <div class="relative z-10">
                        <div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-4">
                                    <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border" 
                                        :class="{
                                            'text-purple-400 border-purple-500/30 bg-purple-500/10': collection.type === 'personal',
                                            'text-orange-400 border-orange-500/30 bg-orange-500/10': collection.type === 'department',
                                            'text-emerald-400 border-emerald-500/30 bg-emerald-500/10': collection.type === 'default'
                                        }">
                                        {{ collection.type }} Collection
                                    </span>
                                </div>
                                
                                <h1 class="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">{{ collection.name }}</h1>
                                <p class="text-slate-300 text-lg max-w-2xl leading-relaxed">{{ collection.description }}</p>
                                
                                <div class="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-400">
                                    <div class="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                                        <UserIcon class="w-4 h-4 text-blue-400" />
                                        <span>Owner: <span class="text-slate-200 font-medium">{{ collection.ownerId === 'system' ? 'System' : 'You' }}</span></span>
                                    </div>
                                    <div class="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                                        <CalendarIcon class="w-4 h-4 text-emerald-400" />
                                        <span>Created: <span class="text-slate-200 font-medium">{{ new Date(collection.createdAt).toLocaleDateString() }}</span></span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                v-if="canManage"
                                @click="showMapModal = true; fetchAvailableKnowledge()"
                                class="flex-none flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5"
                            >
                                <PlusIcon class="w-5 h-5" />
                                Add Knowledge
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Knowledge List Section -->
                <div class="mb-6 flex items-end justify-between">
                    <h2 class="text-2xl font-bold flex items-center gap-3 text-white">
                        <LinkIcon class="w-6 h-6 text-blue-400" />
                        Mapped Content
                        <span class="bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full text-sm font-semibold border border-blue-500/20">{{ collection.knowledgeIds.length }}</span>
                    </h2>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <transition-group 
                        enter-active-class="transition duration-300 ease-out"
                        enter-from-class="transform translate-y-4 opacity-0"
                        enter-to-class="transform translate-y-0 opacity-100"
                    >
                        <div v-for="item in collection.knowledgeIds" :key="item._id" class="group bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800 hover:border-blue-500/30 transition-all duration-200">
                            <div class="flex items-start gap-4">
                                <div class="p-3 bg-slate-700/50 rounded-xl text-blue-400 group-hover:text-blue-300 group-hover:bg-blue-600/20 transition-colors">
                                    <DocumentTextIcon class="w-6 h-6" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-semibold text-slate-100 text-lg mb-1 truncate">{{ item.title }}</h4>
                                    
                                    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
                                        <span class="px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 uppercase font-bold tracking-wider text-[10px]">{{ item.type }}</span>
                                        <span class="flex items-center gap-1" v-if="item.department">
                                            <BuildingOfficeIcon class="w-3 h-3" />
                                            {{ item.department }}
                                        </span>
                                    </div>
                                </div>
                                
                                <button 
                                    v-if="canManage"
                                    @click="unmapKnowledge(item._id)"
                                    class="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Remove from collection"
                                >
                                    <TrashIcon class="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </transition-group>
                    
                    <div v-if="collection.knowledgeIds.length === 0" class="col-span-full py-16 text-center border-2 border-dashed border-slate-700/50 rounded-3xl bg-slate-800/20">
                        <div class="p-4 bg-slate-800/50 rounded-full inline-block mb-3">
                            <LinkIcon class="w-8 h-8 text-slate-600" />
                        </div>
                        <p class="text-slate-400 font-medium">No knowledge mapped to this collection yet.</p>
                        <p class="text-sm text-slate-600 mt-1">Add existing items to get started.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Map Knowledge Modal -->
        <transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
            <div v-if="showMapModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <div class="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <h2 class="text-2xl font-bold text-white">Add Knowledge</h2>
                            <p class="text-slate-400 text-sm">Select items to add to this collection.</p>
                        </div>
                        <button @click="showMapModal = false" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">✕</button>
                    </div>
                    
                    <!-- Search inside modal -->
                    <div class="mb-4">
                        <input 
                            v-model="searchQuery" 
                            type="text" 
                            placeholder="Search available knowledge..." 
                            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                        >
                    </div>

                    <div class="flex-1 overflow-y-auto min-h-0 space-y-2 pr-2 custom-scrollbar">
                        <div 
                            v-for="kb in unmappedKnowledge" 
                            :key="kb._id"
                            @click="mapKnowledge(kb._id)"
                            class="group p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex justify-between items-center"
                        >
                            <div class="flex items-center gap-4">
                                <div class="p-2 bg-slate-900 rounded-lg text-slate-400 group-hover:text-blue-400 transition-colors">
                                    <DocumentTextIcon class="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 class="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{{ kb.title }}</h4>
                                    <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                        <span class="capitalize">{{ kb.type }}</span>
                                        <span>•</span>
                                        <span>{{ kb.department || 'General' }}</span>
                                    </div>
                                </div>
                            </div>
                            <button class="p-2 rounded-lg bg-blue-600/10 text-blue-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white">
                                <PlusIcon class="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div v-if="unmappedKnowledge.length === 0" class="text-center py-10 text-slate-500">
                            <p v-if="searchQuery">No matches found for "{{ searchQuery }}".</p>
                            <p v-else>No other available knowledge found to add.<br>Create more in the Library.</p>
                        </div>
                    </div>
                    
                    <div class="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                        <button @click="showMapModal = false" class="px-5 py-2.5 text-slate-400 hover:text-white font-medium transition-colors">Close</button>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
</style>

