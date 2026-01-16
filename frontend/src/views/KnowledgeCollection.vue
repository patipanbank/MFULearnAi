<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { 
    ArrowLeftIcon, 
    DocumentTextIcon, 
    TrashIcon, 
    PlusIcon, 
    LinkIcon 
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
    <div class="p-6 max-w-5xl mx-auto text-gray-100">
        <button @click="router.push('/knowledge')" class="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            <ArrowLeftIcon class="w-4 h-4" /> Back to Library
        </button>

        <div v-if="isLoading" class="text-center py-12 text-gray-500">Loading...</div>
        
        <div v-else-if="collection">
            <!-- Header -->
            <div class="bg-slate-800 border border-slate-700/50 rounded-2xl p-8 mb-8 relative overflow-hidden">
                <div class="relative z-10">
                    <div class="flex items-center gap-3 mb-2">
                         <h1 class="text-3xl font-bold text-white">{{ collection.name }}</h1>
                         <span class="px-2 py-1 rounded text-xs font-mono uppercase" 
                            :class="{
                                'bg-purple-900/50 text-purple-400': collection.type === 'personal',
                                'bg-orange-900/50 text-orange-400': collection.type === 'department',
                                'bg-green-900/50 text-green-400': collection.type === 'default'
                            }">
                            {{ collection.type }}
                         </span>
                    </div>
                    <p class="text-gray-400 text-lg max-w-2xl">{{ collection.description }}</p>
                    
                    <div class="mt-6 flex items-center gap-4 text-sm text-gray-500">
                        <span>Managed by: {{ collection.ownerId === 'system' ? 'System Admin' : 'Owner' }}</span>
                        <span>Created: {{ new Date(collection.createdAt).toLocaleDateString() }}</span>
                    </div>
                </div>
                
                <!-- Background decoration -->
                <div class="absolute top-0 right-0 p-8 opacity-10">
                    <svg class="w-64 h-64 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>
                </div>
            </div>

            <!-- Knowledge List -->
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold flex items-center gap-2">
                    <LinkIcon class="w-5 h-5 text-blue-400" />
                    Mapped Knowledge
                    <span class="bg-slate-800 px-2 py-0.5 rounded-full text-xs text-gray-400">{{ collection.knowledgeIds.length }}</span>
                </h2>
                <button 
                    v-if="canManage"
                    @click="showMapModal = true; fetchAvailableKnowledge()"
                    class="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <PlusIcon class="w-5 h-5" />
                    Add Knowledge
                </button>
            </div>

            <div class="space-y-3">
                <div v-for="item in collection.knowledgeIds" :key="item._id" class="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                    <div class="flex items-center gap-4">
                        <div class="p-2 bg-slate-700 rounded text-blue-400">
                            <DocumentTextIcon class="w-6 h-6" />
                        </div>
                        <div>
                            <h4 class="font-medium text-gray-200">{{ item.title }}</h4>
                            <div class="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                <span class="uppercase tracking-wider text-[10px] bg-slate-700 px-1 rounded">{{ item.type }}</span>
                                <span>Dept: {{ item.department }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        v-if="canManage"
                        @click="unmapKnowledge(item._id)"
                        class="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove from collection"
                    >
                        <TrashIcon class="w-5 h-5" />
                    </button>
                </div>
                
                <div v-if="collection.knowledgeIds.length === 0" class="text-center py-12 border-2 border-dashed border-slate-700/50 rounded-xl bg-slate-800/20">
                    <p class="text-gray-400">No knowledge mapped to this collection yet.</p>
                </div>
            </div>
        </div>

        <!-- Map Knowledge Modal -->
        <div v-if="showMapModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div class="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-bold text-white">Add Knowledge to Collection</h2>
                    <button @click="showMapModal = false" class="text-gray-400 hover:text-white">✕</button>
                </div>
                
                <div class="flex-1 overflow-y-auto min-h-0 space-y-2 pr-2">
                    <div 
                        v-for="kb in unmappedKnowledge" 
                        :key="kb._id"
                        @click="mapKnowledge(kb._id)"
                        class="p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500 cursor-pointer transition-all flex justify-between items-center"
                    >
                        <div class="flex items-center gap-3">
                            <DocumentTextIcon class="w-5 h-5 text-gray-400" />
                            <div>
                                <h4 class="text-sm font-medium text-gray-200">{{ kb.title }}</h4>
                                <span class="text-xs text-gray-500">{{ kb.type }} • {{ kb.department }}</span>
                            </div>
                        </div>
                        <PlusIcon class="w-5 h-5 text-blue-400" />
                    </div>
                    <div v-if="unmappedKnowledge.length === 0" class="text-center py-8 text-gray-500">
                        No available knowledge found to add. <br>Create more in the Library.
                    </div>
                </div>
                
                <div class="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                    <button @click="showMapModal = false" class="px-4 py-2 text-gray-400 hover:text-white">Close</button>
                </div>
            </div>
        </div>
    </div>
</template>
