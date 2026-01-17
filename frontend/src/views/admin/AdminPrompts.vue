<template>
  <div class="h-full flex flex-col bg-gray-900 text-white p-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold mb-1">System Prompts</h1>
        <p class="text-gray-400 text-sm">Manage system prompts for different environments.</p>
      </div>
      <button 
        @click="refreshPrompts" 
        class="p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
        title="Refresh"
      >
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
      </button>
    </div>

    <div class="flex flex-1 gap-6 overflow-hidden">
      <!-- Prompt List (Left Sidebar) -->
      <div class="w-1/3 bg-gray-800 rounded-xl border border-gray-700 flex flex-col">
        <div class="p-4 border-b border-gray-700 bg-gray-800/50">
          <h2 class="text-lg font-semibold text-gray-200">Available Prompts</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-2">
            <div 
              v-for="prompt in prompts" 
              :key="prompt.key"
              @click="selectPrompt(prompt)"
              class="p-3 rounded-lg cursor-pointer transition-all border group"
              :class="selectedPrompt?.key === prompt.key 
                ? 'bg-blue-600/20 border-blue-500' 
                : 'bg-gray-700/30 border-gray-700 hover:bg-gray-700 hover:border-gray-600'"
            >
              <div class="flex justify-between items-start">
                <span class="font-medium text-gray-200">{{ formatKey(prompt.key) }}</span>
                <span v-if="prompt.key.includes('PROD')" class="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30">Prod</span>
                <span v-else class="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">Test</span>
              </div>
              <p class="text-xs text-gray-400 mt-1 truncate">{{ prompt.description || 'No description' }}</p>
              <div class="mt-2 text-[10px] text-gray-500 flex justify-between">
                 <span>v{{ prompt.version || 1 }}</span>
                 <span>{{ formatDate(prompt.updatedAt) }}</span>
              </div>
            </div>

            <!-- Loading Skeleton -->
            <div v-if="loading && prompts.length === 0" class="space-y-2">
                <div v-for="i in 3" :key="i" class="h-20 bg-gray-700/50 rounded-lg animate-pulse"></div>
            </div>
        </div>
      </div>

      <!-- Editor (Right Content) -->
      <div class="flex-1 bg-gray-800 rounded-xl border border-gray-700 flex flex-col relative overflow-hidden">
        <div v-if="selectedPrompt" class="flex flex-col h-full">
            <!-- Toolbar -->
            <div class="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800/50">
                <div class="flex items-center gap-3">
                    <span class="text-lg font-medium text-blue-400">{{ formatKey(selectedPrompt.key) }}</span>
                    <span class="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">{{ selectedPrompt.key }}</span>
                </div>
                <div class="flex gap-3">
                    <button 
                        @click="resetChanges"
                        :disabled="!hasChanges"
                        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:bg-gray-700"
                    >
                        Reset
                    </button>
                    <button 
                        @click="savePrompt"
                        :disabled="!hasChanges || saving"
                        class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 flex items-center gap-2"
                    >
                        <i v-if="saving" class="fas fa-circle-notch fa-spin"></i>
                        <span>{{ saving ? 'Saving...' : 'Save Changes' }}</span>
                    </button>
                </div>
            </div>

            <!-- Editor Input -->
            <div class="flex-1 relative group">
                <textarea 
                    v-model="editBuffer"
                    class="w-full h-full bg-[#1e1e1e] text-gray-300 p-6 font-mono text-sm leading-relaxed outline-none resize-none focus:bg-[#1a1a1a] transition-colors"
                    spellcheck="false"
                ></textarea>
                <!-- Badge for modifications -->
                <div v-if="hasChanges" class="absolute bottom-4 right-4 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-xs rounded-full">
                    Unsaved Changes
                </div>
            </div>
            
        </div>

        <!-- Empty State -->
        <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-500">
            <i class="fas fa-terminal text-6xl mb-4 opacity-30"></i>
            <p class="text-lg">Select a prompt to edit</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const prompts = ref([]);
const loading = ref(false);
const saving = ref(false);
const selectedPrompt = ref(null);
const editBuffer = ref('');

// Computed
const hasChanges = computed(() => {
    return selectedPrompt.value && editBuffer.value !== selectedPrompt.value.content;
});

// Formatters
const formatKey = (key) => {
    return key
        .replace('_SYSTEM_PROMPT', '')
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
};

// API
const fetchPrompts = async () => {
    loading.value = true;
    try {
        // Mock data if backend is empty (for initial testing, but we should hit API)
        const response = await axios.get('/api/prompts'); // Need to configure proxy or full URL
        // Currently axios base URL might effectively be set in main.js or similar
        // Direct call to orchestrator via Nginx gateway
        // Assuming /api routes go to gateway -> service
        
        if (response.data.prompts && response.data.prompts.length > 0) {
            prompts.value = response.data.prompts;
        } else {
            // Seed defaults if empty so UI isn't blank (Helper for first run)
            prompts.value = [
                { key: 'DINDINAI_SYSTEM_PROMPT', content: 'Loading...', description: 'Production Prompt', isActive: true },
                { key: 'MFULEARNAI_SYSTEM_PROMPT', content: 'Loading...', description: 'Test Environment Prompt', isActive: true }
            ];
            // Fetch individually in background if list endpoint returned empty (optional fallback)
        }
    } catch (error) {
        console.error('Failed to fetch prompts:', error);
        // Fallback mock
        prompts.value = [
            { key: 'DINDINAI_SYSTEM_PROMPT', content: '# Default DinDinAI Prompt\n...', description: 'Default Production', isActive: true },
            { key: 'MFULEARNAI_SYSTEM_PROMPT', content: '# Default MFULearnAI Prompt\n...', description: 'Default Test', isActive: true }
        ];
    } finally {
        loading.value = false;
    }
};

const selectPrompt = (prompt) => {
    // If unsaved changes, maybe warn? For now just switch.
    selectedPrompt.value = prompt;
    editBuffer.value = prompt.content;
};

const resetChanges = () => {
    if (selectedPrompt.value) {
        editBuffer.value = selectedPrompt.value.content;
    }
};

const savePrompt = async () => {
    if (!selectedPrompt.value) return;
    
    saving.value = true;
    try {
        const payload = {
            content: editBuffer.value,
            description: selectedPrompt.value.description
        };
        
        await axios.put(`/api/prompts/${selectedPrompt.value.key}`, payload);
        
        // Update local state
        selectedPrompt.value.content = editBuffer.value;
        const idx = prompts.value.findIndex(p => p.key === selectedPrompt.value.key);
        if (idx !== -1) {
            prompts.value[idx].content = editBuffer.value;
            prompts.value[idx].updatedAt = new Date();
        }
        
        // Notify success (simple alert or toast)
        // alert('Saved successfully');
    } catch (error) {
        console.error('Failed to save prompt:', error);
        alert('Failed to save changes');
    } finally {
        saving.value = false;
    }
};

const refreshPrompts = () => {
    fetchPrompts();
    selectedPrompt.value = null;
};

onMounted(() => {
    fetchPrompts();
});
</script>

<style scoped>
/* Simple scrollbar styling for the editor */
textarea::-webkit-scrollbar {
    width: 6px;
}
textarea::-webkit-scrollbar-track {
    background: #1e1e1e;
}
textarea::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
}
</style>
