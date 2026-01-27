<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <h1>Core System Prompts</h1>
        <p class="subtitle">Manage and Activate the foundational instructions for each environment.</p>
      </div>
      
      <div class="header-actions">
        <button v-if="isSuperAdmin" @click="openCreateModal" class="btn-primary">
            <i class="fas fa-plus mr-2"></i>New Core Prompt
        </button>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- Sidebar List -->
      <div class="sidebar">
        <div class="sidebar-header">
           <div class="flex justify-between items-center">
                <h2>Defined Prompts</h2>
                <button @click="refreshPrompts" class="btn-icon-sm" title="Refresh">
                    <i class="fas fa-sync" :class="{ 'spin': loading }"></i>
                </button>
           </div>
        </div>
        <div class="prompt-list">
            <div v-if="loading && prompts.length === 0" class="p-4 text-center text-muted">Loading...</div>
            <div v-else-if="prompts.length === 0" class="p-4 text-center text-muted">No core prompts found.</div>
            
            <div 
              v-for="prompt in prompts" 
              :key="prompt._id"
              @click="selectPrompt(prompt)"
              class="prompt-item"
              :class="{ 'active': selectedPrompt?._id === prompt._id, 'is-active-core': prompt.isActive }"
            >
              <div class="prompt-header">
                <span class="prompt-name">{{ prompt.name }}</span>
                <div class="flex gap-1">
                    <span v-for="tag in prompt.tags" :key="tag" class="badge badge-tag">{{ tag }}</span>
                    <span v-if="prompt.isActive" class="badge badge-active">ACTIVE</span>
                </div>
              </div>
              <div class="prompt-key">{{ prompt.key }}</div>
              <div class="prompt-meta">
                 <span>v{{ prompt.activeVersion }}</span>
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
                    <span class="toolbar-title">{{ selectedPrompt.name }}</span>
                    <span class="toolbar-key">{{ selectedPrompt.key }}</span>
                    <span v-if="selectedPrompt.isActive" class="badge badge-active ml-2">Currently Active</span>
                </div>
                <div class="toolbar-actions">
                    <button 
                        v-if="isSuperAdmin && !selectedPrompt.isActive"
                        @click="activatePrompt"
                        :disabled="activating"
                        class="btn-secondary text-green-400 border-green-800 hover:bg-green-900"
                    >
                        {{ activating ? 'Activating...' : 'Set as Active' }}
                    </button>
                    
                    <button 
                        v-if="isSuperAdmin"
                        @click="saveVersion"
                        :disabled="!hasChanges || saving"
                        class="btn-primary"
                    >
                        {{ saving ? 'Saving...' : 'Save New Version' }}
                    </button>
                </div>
            </div>

            <!-- Version/Changelog Inputs -->
            <div v-if="hasChanges" class="p-3 bg-gray-800 border-b border-gray-700 flex gap-2">
                <input v-model="changeLog" placeholder="Describe changes (required to save)" class="form-input flex-1 h-8 text-sm" />
            </div>

            <!-- Text Area -->
            <div class="editor-wrapper">
                <textarea 
                    v-model="editBuffer"
                    class="code-editor"
                    spellcheck="false"
                    :disabled="!isSuperAdmin"
                    placeholder="Enter system prompt content..."
                ></textarea>
                <div v-if="hasChanges" class="unsaved-badge">Unsaved Changes</div>
            </div>
        </div>

            <!-- Empty State -->
        <div v-else class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            <p>Select a core prompt to view or edit</p>
        </div>
      </div>
    </div>
    
    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3>New Core Prompt</h3>
                <button @click="closeCreateModal" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Internal Key (Unique) <span class="text-red-500">*</span></label>
                    <input v-model="newItem.key" type="text" placeholder="e.g. DINDINAI_STRICT_V2" class="form-input" />
                    <small class="text-muted block mt-1">Recommended: Use environment suffix e.g. _PROD or _TEST</small>
                </div>
                <div class="form-group">
                    <label>Display Name <span class="text-red-500">*</span></label>
                    <input v-model="newItem.name" type="text" placeholder="e.g. DinDin Strict Mode" class="form-input" />
                </div>
                <div class="form-group">
                    <label>Initial Content</label>
                    <textarea v-model="newItem.content" class="form-input h-32 font-mono"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button @click="closeCreateModal" class="btn-secondary mr-2">Cancel</button>
                <button @click="createPrompt" :disabled="!newItem.key || !newItem.name || creating" class="btn-primary">
                    {{ creating ? 'Creating...' : 'Create Draft' }}
                </button>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../../utils/api'; 
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const isSuperAdmin = computed(() => authStore.role === 'superadmin');

const prompts = ref([]);
const loading = ref(false);
const saving = ref(false);
const activating = ref(false);
const creating = ref(false);
const showCreateModal = ref(false);
const selectedPrompt = ref(null);
const editBuffer = ref('');
const changeLog = ref('');

const newItem = ref({ key: '', name: '', content: '' });

const hasChanges = computed(() => {
    if (!selectedPrompt.value) return false;
    // Compare editBuffer with the ACTIVE version content from the object
    // Note: The API returns 'activeVersion' number. We need to find that version in 'versions' array?
    // The current GET /api/prompts list returns summary. Details only on GET /:key ? 
    // Wait, the API I wrote returns everything for now.
    // Let's assume we fetch full details on select if needed, or use what we have.
    // The previous API implementation returned "prompt" object with "versions" array.
    // Let's assume on select we might want to refresh details.
    return editBuffer.value !== getCurrentContent(selectedPrompt.value);
});

const getCurrentContent = (prompt) => {
    if (!prompt || !prompt.versions) return '';
    // If we have versions array, find the active one
    const v = prompt.versions.find(ver => ver.version === prompt.activeVersion);
    return v ? v.content : (prompt.versions[0]?.content || '');
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
};

// Actions
const fetchPrompts = async () => {
    loading.value = true;
    try {
        const res = await api.get('/prompts?type=core');
        prompts.value = res.data.prompts || [];
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const selectPrompt = async (prompt) => {
    if (hasChanges.value) {
        if(!confirm('Discard unsaved changes?')) return;
    }
    
    // Fetch full details (versions)
    try {
        const res = await api.get(`/prompts/${prompt.key}`);
        selectedPrompt.value = res.data.prompt;
        editBuffer.value = getCurrentContent(selectedPrompt.value);
        changeLog.value = '';
    } catch (e) {
        console.error(e);
    }
};

const saveVersion = async () => {
    if (!changeLog.value) {
        alert('Please enter a changelog description.');
        return;
    }
    saving.value = true;
    try {
        const res = await api.post(`/prompts/${selectedPrompt.value.key}/versions`, {
            content: editBuffer.value,
            changelog: changeLog.value
        });
        
        // Refresh
        await selectPrompt(selectedPrompt.value);
        await fetchPrompts(); // Refresh list to show version update
        alert('New version saved!');
    } catch (e) {
        alert(e.response?.data?.error || 'Failed to save');
    } finally {
        saving.value = false;
    }
};

const activatePrompt = async () => {
    if (!confirm('Are you sure you want to ACTIVATE this prompt? It will immediately affect all users in this environment.')) return;
    
    activating.value = true;
    try {
        await api.post(`/prompts/${selectedPrompt.value.key}/activate`);
        selectedPrompt.value.isActive = true;
        await fetchPrompts();
        alert('Prompt Activated!');
    } catch (e) {
        alert(e.response?.data?.error || 'Failed to activate');
    } finally {
        activating.value = false;
    }
};

const openCreateModal = () => { newItem.value = { key: '', name: '', content: '' }; showCreateModal.value = true; };
const closeCreateModal = () => { showCreateModal.value = false; };

const createPrompt = async () => {
    creating.value = true;
    try {
        await api.post('/prompts', {
            type: 'core',
            key: newItem.value.key,
            name: newItem.value.name,
            content: newItem.value.content,
            description: 'Core System Prompt'
        });
        await fetchPrompts();
        closeCreateModal();
    } catch (e) {
        alert(e.response?.data?.error || 'Creation failed');
    } finally {
        creating.value = false;
    }
};

onMounted(() => fetchPrompts());
</script>

<style scoped>
/* CSS Variables Usage for Theme Compatibility */
.page-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 24px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
}

.header-left h1 {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px 0;
    color: var(--color-text-primary);
}

.subtitle {
    color: var(--color-text-muted);
    font-size: 14px;
}

.content-wrapper {
    flex: 1;
    display: flex;
    gap: 24px;
    overflow: hidden;
}

/* Responsive: Stack sidebar and editor on small screens */
@media (max-width: 768px) {
    .content-wrapper {
        flex-direction: column;
    }
    .sidebar {
        width: 100%;
        height: 250px; /* Fixed height for list when stacked */
        flex: none;
    }
    .editor-container {
        flex: 1;
    }
}

/* Sidebar */
.sidebar {
    width: 320px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}

.sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--color-border);
}

.sidebar-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--color-text-primary);
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
    background: var(--color-bg-hover);
}

.prompt-item.active {
    background: var(--color-bg-tertiary);
    border-color: var(--color-accent);
}

.prompt-item.is-active-core {
    border-left: 3px solid #10b981;
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
    color: var(--color-text-primary);
}

.prompt-key {
    font-family: monospace;
    font-size: 11px;
    color: var(--color-text-muted);
    margin-bottom: 6px;
}

.badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 999px;
    font-weight: 600;
    text-transform: uppercase;
}
.badge-active { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.badge-tag { background: rgba(96, 165, 250, 0.2); color: #60a5fa; margin-right: 4px; }

.prompt-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--color-text-secondary);
}

/* Editor */
.editor-container {
    flex: 1;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0; /* Prevent flex overflow */
}

.editor-content {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.editor-toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
}

.toolbar-info {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
}

.toolbar-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-accent);
}

.toolbar-key {
    font-size: 12px;
    color: var(--color-text-muted);
    font-family: monospace;
    background: var(--color-bg-primary);
    padding: 2px 6px;
    border-radius: 4px;
}

.toolbar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.btn-secondary {
    background: transparent;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
}
.btn-secondary:hover:not(:disabled) {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
}
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
    background: var(--color-accent);
    color: white;
    border: none;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Icon Button */
.btn-icon-sm {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
}
.btn-icon-sm:hover { color: var(--color-text-primary); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

.editor-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
}

.code-editor {
    flex: 1;
    background: #1e1e1e; /* Keep dark for code always? or use var? Let's use darker bg */
    color: #e5e7eb;
    border: none;
    padding: 20px;
    font-family: 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.6;
    resize: none;
    outline: none;
}
/* If light mode is supported, we might want light editor, but typically code editors stay dark. 
   For consistency with the app theme, let's try to verify if we want standard editor look.
   For now keeping it dark #1e1e1e fits most 'code' vibes. 
*/

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

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    width: 500px;
    max-width: 90%;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

.modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 24px;
    cursor: pointer;
}
.close-btn:hover { color: var(--color-text-primary); }

.modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary);
}

.form-input {
    width: 100%;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 10px;
    border-radius: 6px;
    font-size: 14px;
}
.form-input:focus {
    outline: none;
    border-color: var(--color-accent);
}

.modal-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
    background: var(--color-bg-tertiary);
    border-radius: 0 0 12px 12px;
}
</style>
