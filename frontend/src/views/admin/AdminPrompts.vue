<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <h1>System Prompts</h1>
        <p class="subtitle">Manage AI personality and behavior instructions.</p>
      </div>
      <button 
        @click="refreshPrompts" 
        class="btn-icon-only"
        title="Refresh"
        :disabled="loading"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'spin': loading }"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
      </button>
    </div>

    <div class="content-wrapper">
      <!-- Sidebar List -->
      <div class="sidebar">
        <div class="sidebar-header">
           <h2>Available Prompts</h2>
        </div>
        <div class="prompt-list">
            <div v-if="loading && prompts.length === 0" class="p-4 text-center text-muted">Loading...</div>
            <div v-else-if="prompts.length === 0" class="p-4 text-center text-muted">No prompts found.</div>
            
            <div 
              v-for="prompt in prompts" 
              :key="prompt.key"
              @click="selectPrompt(prompt)"
              class="prompt-item"
              :class="{ 'active': selectedPrompt?.key === prompt.key }"
            >
              <div class="prompt-header">
                <span class="prompt-name">{{ formatKey(prompt.key) }}</span>
                <span v-if="prompt.key.includes('PROD')" class="badge badge-prod">PROD</span>
                <span v-else class="badge badge-test">TEST</span>
              </div>
              <p class="prompt-desc">{{ prompt.description || 'No description' }}</p>
              <div class="prompt-meta">
                 <span>v{{ prompt.version || 1 }}</span>
                 <span>{{ formatDate(prompt.updatedAt) }}</span>
              </div>
            </div>
        </div>
      </div>

      <!-- Editor Area -->
      <div class="editor-container">
        <div v-if="selectedPrompt" class="editor-content">
            <!-- Toolbar -->
            <div class="editor-toolbar">
                <div class="toolbar-info">
                    <span class="toolbar-title">{{ formatKey(selectedPrompt.key) }}</span>
                    <span class="toolbar-key">{{ selectedPrompt.key }}</span>
                </div>
                <div class="toolbar-actions">
                    <span v-if="!isSuperAdmin" class="read-only-badge">Read Only</span>
                    <button 
                        v-if="isSuperAdmin"
                        @click="resetChanges"
                        :disabled="!hasChanges"
                        class="btn-secondary"
                    >
                        Reset
                    </button>
                    <button 
                        v-if="isSuperAdmin"
                        @click="savePrompt"
                        :disabled="!hasChanges || saving"
                        class="btn-primary"
                    >
                        {{ saving ? 'Saving...' : 'Save Changes' }}
                    </button>
                </div>
            </div>

            <!-- Text Area -->
            <div class="editor-wrapper">
                <textarea 
                    v-model="editBuffer"
                    class="code-editor"
                    spellcheck="false"
                    :disabled="!isSuperAdmin"
                ></textarea>
                <div v-if="hasChanges" class="unsaved-badge">Unsaved Changes</div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            <p>Select a system prompt to view or edit</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../../utils/api'; // Use consistent API utility
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const isSuperAdmin = computed(() => authStore.role === 'superadmin');

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
        const response = await api.get('/prompts'); 
        if (response.data.prompts && response.data.prompts.length > 0) {
            prompts.value = response.data.prompts;
        } else {
            // Fallback for first run UI experience if DB is empty but Backend has hardcoded defaults
            // In a real scenario, we might want an endpoint to 'sync' defaults to DB
            // asking user to trigger it is usually safer
            prompts.value = [];
        }
    } catch (error) {
        console.error('Failed to fetch prompts:', error);
        // Do not use mock data here to avoid confusion. Show error state or empty.
    } finally {
        loading.value = false;
    }
};

const selectPrompt = (prompt) => {
    if (hasChanges.value) {
        if(!confirm('You have unsaved changes. Discard them?')) return;
    }
    selectedPrompt.value = prompt;
    editBuffer.value = prompt.content;
};

const resetChanges = () => {
    if (selectedPrompt.value) {
        editBuffer.value = selectedPrompt.value.content;
    }
};

const savePrompt = async () => {
    if (!selectedPrompt.value || !isSuperAdmin.value) return;
    
    saving.value = true;
    try {
        const payload = {
            content: editBuffer.value,
            description: selectedPrompt.value.description
        };
        
        await api.put(`/prompts/${selectedPrompt.value.key}`, payload);
        
        // Update local state
        selectedPrompt.value.content = editBuffer.value;
        selectedPrompt.value.updatedAt = new Date().toISOString();
        
        // Update list item
        const idx = prompts.value.findIndex(p => p.key === selectedPrompt.value.key);
        if (idx !== -1) {
            prompts.value[idx].content = editBuffer.value;
            prompts.value[idx].updatedAt = selectedPrompt.value.updatedAt;
        }
    } catch (error) {
        console.error('Failed to save prompt:', error);
        alert(error.response?.data?.error || 'Failed to save changes');
    } finally {
        saving.value = false;
    }
};

const refreshPrompts = () => {
    fetchPrompts();
    selectedPrompt.value = null;
    editBuffer.value = '';
};

onMounted(() => {
    fetchPrompts();
});
</script>

<style scoped>
.page-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 24px;
    background: var(--color-bg-primary, #121212);
    color: var(--color-text-primary, #ffffff);
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
}

.header-left h1 {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px 0;
}

.subtitle {
    color: var(--color-text-muted, #9ca3af);
    font-size: 14px;
}

.btn-icon-only {
    background: var(--color-bg-tertiary, #2a2a2a);
    border: 1px solid var(--color-border, #374151);
    color: var(--color-text-secondary, #d1d5db);
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
}
.btn-icon-only:hover {
    background: var(--color-bg-hover, #333);
    color: white;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

.content-wrapper {
    flex: 1;
    display: flex;
    gap: 24px;
    overflow: hidden;
}

/* Sidebar */
.sidebar {
    width: 320px;
    background: var(--color-bg-secondary, #1e1e1e);
    border: 1px solid var(--color-border, #374151);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--color-border, #374151);
}

.sidebar-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
}

.prompt-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.prompt-item {
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
}

.prompt-item:hover {
    background: var(--color-bg-tertiary, #2a2a2a);
}

.prompt-item.active {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.5);
}

.prompt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.prompt-name {
    font-weight: 500;
    font-size: 14px;
}

.badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 999px;
    font-weight: 600;
    text-transform: uppercase;
}
.badge-prod { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.badge-test { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

.prompt-desc {
    font-size: 12px;
    color: var(--color-text-muted, #9ca3af);
    margin: 0 0 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.prompt-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--color-text-secondary, #6b7280);
}

/* Editor */
.editor-container {
    flex: 1;
    background: var(--color-bg-secondary, #1e1e1e);
    border: 1px solid var(--color-border, #374151);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.editor-content {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.editor-toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #374151);
    background: var(--color-bg-tertiary, #252525);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.toolbar-info {
    display: flex;
    align-items: baseline;
    gap: 12px;
}

.toolbar-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-accent, #60a5fa);
}

.toolbar-key {
    font-size: 12px;
    color: var(--color-text-muted);
    font-family: monospace;
    background: rgba(0,0,0,0.2);
    padding: 2px 6px;
    border-radius: 4px;
}

.toolbar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.read-only-badge {
    font-size: 12px;
    color: var(--color-text-muted);
    background: rgba(255,255,255,0.1);
    padding: 4px 8px;
    border-radius: 4px;
    margin-right: 8px;
}

.btn-secondary {
    background: transparent;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
}
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
    background: var(--color-accent, #2563eb);
    color: white;
    border: none;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.editor-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
}

.code-editor {
    flex: 1;
    background: #151515; /* Darker than card */
    color: #e5e7eb;
    border: none;
    padding: 20px;
    font-family: 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.6;
    resize: none;
    outline: none;
}
.code-editor:disabled {
    opacity: 0.8;
    cursor: default;
}

.unsaved-badge {
    position: absolute;
    bottom: 16px;
    right: 16px;
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    pointer-events: none;
}

.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    gap: 16px;
}
</style>
