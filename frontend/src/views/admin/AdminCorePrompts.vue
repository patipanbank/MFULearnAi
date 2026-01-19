<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-content w-full">
        <div class="flex justify-between items-start mb-2">
            <div class="hidden md:block">
                <h1>{{ t('coreSystemPrompts') }}</h1>
                <p class="subtitle">{{ t('corePromptWarning') }}</p>
            </div>
             <div class="header-actions">
                <button v-if="isSuperAdmin" @click="openCreateModal" class="btn-primary">
                    <i class="fas fa-plus mr-2"></i>{{ t('createPrompt') }}
                </button>
            </div>
        </div>

        <!-- Mobile Selector -->
        <div class="md:hidden mt-4">
            <select :value="selectedPrompt?._id" @change="e => selectPromptById(e.target.value)" class="form-select w-full">
                <option :value="undefined" disabled>{{ t('selectPrompt') || 'Select Prompt' }}</option>
                <option v-for="p in prompts" :key="p._id" :value="p._id">
                    {{ p.name }} <span v-if="p.isActive">({{ t('active') }})</span>
                </option>
            </select>
        </div>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- Sidebar List -->
      <div class="sidebar hidden-mobile">
        <div class="sidebar-header">
           <div class="flex justify-between items-center">
                <h2>{{ t('coreSystemPrompts') }}</h2>
                <button @click="refreshPrompts" class="btn-icon-sm" :title="t('refresh')">
                    <i class="fas fa-sync" :class="{ 'spin': loading }"></i>
                </button>
           </div>
        </div>
        <div class="prompt-list">
            <div v-if="loading && prompts.length === 0" class="p-4 text-center text-muted">{{ t('loading') || 'Loading...' }}</div>
            <div v-else-if="prompts.length === 0" class="p-4 text-center text-muted">{{ t('noPrompts') || 'No prompts found.' }}</div>
            
            <div 
              v-for="prompt in prompts" 
              :key="prompt._id"
              @click="selectPrompt(prompt)"
              class="prompt-item"
              :class="{ 'active': selectedPrompt?._id === prompt._id, 'is-active-core': prompt.isActive }"
            >
              <div class="prompt-header">
                <span class="prompt-name">{{ prompt.name }}</span>
                <span v-if="prompt.isActive" class="badge badge-active">{{ t('isActive') }}</span>
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
      <div class="editor-container" :class="{ 'visible-mobile': selectedPrompt && isMobile, 'hidden-mobile': !selectedPrompt && isMobile }">
        <div v-if="selectedPrompt" class="editor-content">
            <!-- Toolbar -->
            <div class="editor-toolbar">
                <div class="toolbar-info">
                    <span class="toolbar-title">{{ selectedPrompt.name }}</span>
                    <span class="toolbar-key">{{ selectedPrompt.key }}</span>
                    <span v-if="selectedPrompt.isActive" class="badge badge-active ml-2">{{ t('isActive') }}</span>
                </div>
                <div class="toolbar-actions">
                    <button 
                        v-if="isSuperAdmin && !selectedPrompt.isActive"
                        @click="activatePrompt"
                        :disabled="activating"
                        class="btn-secondary text-green-400 border-green-800 hover:bg-green-900"
                    >
                        {{ activating ? t('activating') || '...' : t('activate') }}
                    </button>

                    <button 
                        v-if="isSuperAdmin && selectedPrompt.isActive"
                        @click="deactivatePrompt"
                        :disabled="activating"
                        class="btn-secondary text-yellow-500 border-yellow-800 hover:bg-yellow-900"
                    >
                        {{ activating ? t('processing') || '...' : t('deactivate') }}
                    </button>
                    
                    <button 
                        v-if="isSuperAdmin"
                        @click="saveVersion"
                        :disabled="!hasChanges || saving"
                        class="btn-primary"
                    >
                        {{ saving ? t('saving') || '...' : t('saveVersion') }}
                    </button>

                    <button 
                         v-if="isSuperAdmin"
                         @click="deletePrompt"
                         class="btn-icon-danger ml-2"
                         :title="t('delete')"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            <!-- Version/Changelog Inputs -->
            <div v-if="hasChanges" class="p-3 bg-tertiary border-b border-color flex gap-2">
                <input v-model="changeLog" :placeholder="t('changeLogPlaceholder') || 'Describe changes...'" class="form-input flex-1 h-8 text-sm" />
            </div>

            <!-- Text Area -->
            <div class="editor-wrapper">
                <textarea 
                    v-model="editBuffer"
                    class="code-editor"
                    spellcheck="false"
                    :disabled="!isSuperAdmin"
                    :placeholder="t('content')"
                ></textarea>
                <div v-if="hasChanges" class="unsaved-badge">{{ t('unsaved') || 'Unsaved' }}</div>
            </div>
        </div>

            <!-- Empty State -->
        <div v-else class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            <p>{{ t('filterPrompts') }}</p>
        </div>
      </div>
    </div>
    
    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3>{{ t('createPrompt') }}</h3>
                <button @click="closeCreateModal" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>{{ t('internalKey') }} <span class="text-red-500">*</span></label>
                    <input v-model="newItem.key" type="text" placeholder="e.g. DINDINAI_STRICT_V2" class="form-input" />
                    <small class="text-muted block mt-1">{{ t('autoGenerated') || 'Recommended: Use env suffix' }}</small>
                </div>
                <div class="form-group">
                    <label>{{ t('displayName') }} <span class="text-red-500">*</span></label>
                    <input v-model="newItem.name" type="text" placeholder="e.g. DinDin Strict Mode" class="form-input" />
                </div>

                <div class="form-group">
                    <label>{{ t('content') }}</label>
                    <textarea v-model="newItem.content" class="form-input h-32 font-mono"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button @click="closeCreateModal" class="btn-secondary mr-2">{{ t('cancel') }}</button>
                <button @click="createPrompt" :disabled="!newItem.key || !newItem.name || creating" class="btn-primary">
                    {{ creating ? t('creating') || '...' : t('create') || 'Create' }}
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
import { useLanguage } from '@/composables/useSettings';

const authStore = useAuthStore();
const { t } = useLanguage();
const isSuperAdmin = computed(() => authStore.role === 'superadmin');

const isMobile = ref(window.innerWidth < 768);
window.addEventListener('resize', () => { isMobile.value = window.innerWidth < 768; });

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

const selectPromptById = (id) => {
    const p = prompts.value.find(x => x._id === id);
    if(p) selectPrompt(p);
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

const deactivatePrompt = async () => {
    if (!confirm('Are you sure you want to DEACTIVATE this core prompt? The system will fall back to default hardcoded prompts.')) return;
    
    activating.value = true;
    try {
        await api.post(`/prompts/${selectedPrompt.value.key}/deactivate`);
        selectedPrompt.value.isActive = false;
        await fetchPrompts();
        alert('Prompt Deactivated! System will now use hardcoded defaults.');
    } catch (e) {
        alert(e.response?.data?.error || 'Failed to deactivate');
    } finally {
        activating.value = false;
    }
};

const deletePrompt = async () => {
    if (!selectedPrompt.value) return;
    if (selectedPrompt.value.isActive) {
        alert('Cannot delete an active prompt. Deactivate it first.');
        return;
    }
    if (!confirm(`CRITICAL WARNING: Are you sure you want to delete core prompt "${selectedPrompt.value.name}"? This is permanent.`)) return;

    try {
        await api.delete(`/prompts/${selectedPrompt.value.key}`);
        selectedPrompt.value = null;
        await fetchPrompts();
    } catch (e) {
        alert(e.response?.data?.error || 'Deletion failed');
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
            tags: ['GLOBAL'], // Default tag for consistency, though unused by logic now
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

/* Icon Button */
.btn-icon-sm {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
}
.btn-icon-sm:hover { color: white; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Improved Delete Icon Visibility */
.btn-icon-danger {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}
.btn-icon-danger:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    transform: scale(1.05);
}

.editor-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
}

.code-editor {
    flex: 1;
    background: var(--color-bg-primary); /* Matches page/editor bg */
    color: var(--color-text-primary);
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

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: var(--color-bg-secondary, #1e1e1e);
    border: 1px solid var(--color-border, #374151);
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
}

.close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 24px;
    cursor: pointer;
}

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
    background: var(--color-bg-tertiary, #2a2a2a);
    border: 1px solid var(--color-border);
    color: white;
    padding: 10px;
    border-radius: 6px;
    font-size: 14px;
}
.form-input:focus {
    outline: none;
    border-color: var(--color-accent, #3b82f6);
}

.modal-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
}


.form-select {
    width: 100%;
    background: var(--color-bg-tertiary, #2a2a2a);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 10px;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
}
.form-select:focus { border-color: var(--color-accent); }

/* Mobile Responsiveness */
@media (max-width: 768px) {
    .page-container {
        padding: 16px;
    }
    
    .content-wrapper {
        position: relative;
        overflow: hidden;
        flex-direction: column;
    }

    /* Hide Sidebar completely on mobile, replaced by dropdown */
    .sidebar.hidden-mobile {
        display: none;
    }

    .editor-container {
        /* Always show editor */
        position: relative; 
        flex: 1;
        background: var(--color-bg-primary); 
        z-index: 1;
        width: 100%;
        display: flex !important; /* Override any hidden logic */
        transform: none !important;
    }

    /* Reset absolute positioning for mobile editor since it's just flow now */
    .editor-container.hidden-mobile { display: flex !important; transform: none !important; }
    .editor-container.visible-mobile { display: flex; transform: none; }
}

/* Theme Colors Semantic Classes */
.bg-tertiary { background: var(--color-bg-tertiary, #2a2a2a); }
.border-color { border-color: var(--color-border, #374151); }
</style>
