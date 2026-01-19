<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-content w-full">
        <div class="flex justify-between items-start mb-2">
            <div class="hidden lg:block">
                <h1>{{ t('myPersonas') }}</h1>
                <p class="subtitle">{{ t('knowledgeSubtitle') }}</p>
            </div>
            <div class="header-actions">
                <button @click="openCreateModal" class="btn-primary">
                    <i class="fas fa-plus mr-2"></i>{{ t('createPersona') }}
                </button>
            </div>
        </div>
        
        <!-- Mobile/Tablet Selector -->
        <div class="lg:hidden mt-4">
            <select :value="selectedPrompt?._id" @change="e => selectPromptById(e.target.value)" class="form-select w-full">
                <option :value="undefined" disabled>{{ t('selectPersona') || 'Select Persona' }}</option>
                <option v-for="p in myScenarios" :key="p._id" :value="p._id">
                    {{ p.name }} <span v-if="isActiveScenario(p._id)">({{ t('active') }})</span>
                </option>
            </select>
        </div>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- Sidebar List -->
      <div class="sidebar">
        <div class="sidebar-header">
           <div class="flex justify-between items-center">
                <h2>{{ t('myPersonas') }}</h2>
                <button @click="refreshPrompts" class="btn-icon-sm" :title="t('refresh')">
                    <i class="fas fa-sync" :class="{ 'spin': loading }"></i>
                </button>
           </div>
        </div>
        <div class="prompt-list">
            <div v-if="loading && prompts.length === 0" class="p-4 text-center text-muted">{{ t('loading') || 'Loading...' }}</div>
            <div v-else-if="prompts.length === 0" class="p-4 text-center text-muted">{{ t('noPersonas') || 'No personas found.' }}</div>
            
            <div 
              v-for="prompt in myScenarios" 
              :key="prompt._id"
              @click="selectPrompt(prompt)"
              class="prompt-item"
              :class="{ 'active': selectedPrompt?._id === prompt._id, 'is-active-core': isActiveScenario(prompt._id) }"
            >
              <div class="prompt-header">
                <span class="prompt-name">{{ prompt.name }}</span>
                <span v-if="isActiveScenario(prompt._id)" class="badge badge-active">{{ t('isActive') }}</span>
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
                    <!-- <span class="toolbar-key">{{ selectedPrompt.key }}</span> -->
                    <span v-if="selectedPrompt.isPublic" class="badge badge-public ml-2">{{ t('public') }}</span>
                    <span v-if="isActiveScenario(selectedPrompt._id)" class="badge badge-active ml-2">{{ t('isActive') }}</span>
                </div>
                <div class="toolbar-actions">
                     <button @click="openPlayground" class="btn-secondary">
                        <i class="fas fa-play mr-2"></i><span class="hidden sm:inline">{{ t('playground') }}</span>
                    </button>

                    <button 
                        v-if="!isActiveScenario(selectedPrompt._id)"
                        @click="activateScenario"
                        class="btn-secondary text-green-400 border-green-800 hover:bg-green-900"
                    >
                        <i class="fas fa-check mr-2"></i>{{ t('activate') }}
                    </button>

                    <button 
                        v-else
                        @click="deactivateScenario"
                        class="btn-secondary text-yellow-500 border-yellow-800 hover:bg-yellow-900"
                    >
                         <i class="fas fa-times mr-2"></i>{{ t('deactivate') }}
                    </button>
                    
                    <button 
                        v-if="canEdit(selectedPrompt)"
                        @click="saveVersion"
                        :disabled="!hasChanges || saving"
                        class="btn-primary"
                    >
                        {{ saving ? t('saving') || '...' : t('saveVersion') }}
                    </button>

                    <button 
                         v-if="canEdit(selectedPrompt)"
                         @click="deleteScenario"
                         class="btn-icon-danger ml-2"
                         :title="t('delete')"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            <!-- Version/Changelog Inputs -->
            <div class="p-3 bg-tertiary border-b border-color flex flex-col gap-2">
                 <!-- Description Edit -->
                <div class="flex gap-2 items-center">
                     <span class="text-xs text-muted w-24 pt-1 uppercase font-bold tracking-wider">{{ t('description') }}</span>
                     <input 
                        v-if="canEdit(selectedPrompt)"
                        v-model="editDescription" 
                        class="form-input flex-1 h-8 text-sm" 
                        :placeholder="t('description')"
                    />
                    <div v-else class="flex-1 text-sm py-1 px-2 text-primary">{{ selectedPrompt.description }}</div>
                </div>
                <!-- Changelog (Only shows if content changed) -->
                <div v-if="hasChanges" class="flex gap-2 items-center">
                    <span class="text-xs text-muted w-24 pt-1 uppercase font-bold tracking-wider">{{ t('changelog') }}</span>
                    <input v-model="changeLog" :placeholder="t('changeLogPlaceholder') || 'Describe changes...'" class="form-input flex-1 h-8 text-sm" />
                </div>
            </div>

            <!-- Text Area -->
            <div class="editor-wrapper">
                <textarea 
                    v-model="editBuffer"
                    class="code-editor"
                    spellcheck="false"
                    :disabled="!canEdit(selectedPrompt)"
                    :placeholder="t('content')"
                ></textarea>
                <div v-if="hasChanges" class="unsaved-badge">{{ t('unsaved') || 'Unsaved' }}</div>
            </div>
        </div>

            <!-- Empty State -->
        <div v-else class="empty-state">
             <i class="fas fa-robot text-6xl text-muted mb-4 opacity-50"></i>
            <p>{{ t('searchPersonas') }}</p>
        </div>
      </div>
    </div>
    
    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3>{{ t('createPersona') }}</h3>
                <button @click="closeCreateModal" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>{{ t('internalKey') }}</label>
                    <input v-model="newItem.key" type="text" placeholder="e.g. PYTHON_HELPER" class="form-input" />
                    <small class="text-muted block mt-1">{{ t('autoGenerated') || 'Auto-generated if empty' }}</small>
                </div>
                <div class="form-group">
                    <label>{{ t('name') }} <span class="text-red-500">*</span></label>
                    <input v-model="newItem.name" type="text" placeholder="e.g. Python Expert" class="form-input" />
                </div>
                 <div class="form-group">
                     <label>{{ t('description') }}</label>
                    <input v-model="newItem.description" type="text" class="form-input" />
                </div>
                <div class="form-group">
                    <label>{{ t('content') }}</label>
                    <textarea v-model="newItem.content" class="form-input h-32 font-mono"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button @click="closeCreateModal" class="btn-secondary mr-2">{{ t('cancel') }}</button>
                <button @click="createPrompt" :disabled="!newItem.name || creating" class="btn-primary">
                    {{ creating ? t('creating') || '...' : t('create') || 'Create' }}
                </button>
            </div>
        </div>
    </div>

    <!-- Playground Modal -->
    <div v-if="showPlayground" class="modal-overlay" @click.self="closePlayground">
         <div class="modal-content playground-modal">
            <div class="modal-header bg-tertiary">
                <h3>Test Persona: {{ selectedPrompt.name }}</h3>
                <button @click="closePlayground" class="close-btn">&times;</button>
            </div>
             <div class="playground-body flex flex-col h-[500px]">
                  <div class="chat-preview flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-primary">
                        <div v-if="testMessages.length === 0" class="text-center text-muted mt-10">
                            Start a conversation to test these instructions.
                        </div>
                        <div v-for="(msg, i) in testMessages" :key="i" class="chat-msg" :class="msg.role">
                            <div class="bubble">{{ msg.content }}</div>
                        </div>
                        <div v-if="testing" class="chat-msg assistant">
                            <div class="bubble typing">...</div>
                        </div>
                   </div>
                   <div class="p-3 border-t border-color bg-tertiary flex gap-2">
                        <input 
                            v-model="testInput" 
                            @keyup.enter="sendMessage"
                            placeholder="Type a test message..." 
                            class="form-input flex-1"
                        />
                        <button @click="sendMessage" :disabled="!testInput || testing" class="btn-primary">
                            Send
                        </button>
                   </div>
             </div>
         </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../utils/api'; 
import { useAuthStore } from '../stores/auth';
import { useChatStore } from '../stores/chat';
import { useLanguage } from '@/composables/useSettings';

const authStore = useAuthStore();
const chatStore = useChatStore();
const router = useRouter();
const { t } = useLanguage();

const isMobile = ref(window.innerWidth < 1024);
window.addEventListener('resize', () => { isMobile.value = window.innerWidth < 1024; });

const isSuperAdmin = computed(() => authStore.role === 'superadmin');
const userId = computed(() => authStore.userId);
const activeScenarioId = computed(() => chatStore.currentScenarioId);

const prompts = ref([]);
const loading = ref(false);
const saving = ref(false);
const creating = ref(false);
const showCreateModal = ref(false);
const showPlayground = ref(false);

const selectedPrompt = ref(null);
const editBuffer = ref('');
const editDescription = ref('');
const changeLog = ref('');

const newItem = ref({ key: '', name: '', description: '', content: '', isPublic: false });

// Test State
const testInput = ref('');
const testMessages = ref([]);
const testing = ref(false);

const myScenarios = computed(() => {
    // Strictly specific to owner. Even if backend returns public, we filter UI side to be consistent with "My Persona" view.
    return prompts.value.filter(s => s.ownerId === userId.value); 
});

const isActiveScenario = (id) => activeScenarioId.value === id;

const canEdit = (item) => {
    return item && (item.ownerId === userId.value || isSuperAdmin.value);
};

const hasChanges = computed(() => {
    if (!selectedPrompt.value) return false;
    return editBuffer.value !== getCurrentContent(selectedPrompt.value) || 
           editDescription.value !== selectedPrompt.value.description;
});

const getCurrentContent = (prompt) => {
    if (!prompt || !prompt.versions) return '';
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
        const res = await api.get('/prompts?type=scenario');
        prompts.value = res.data.prompts || [];
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const refreshPrompts = () => fetchPrompts();

const selectPromptById = (id) => {
    const p = prompts.value.find(x => x._id === id);
    if(p) selectPrompt(p);
};

const selectPrompt = async (prompt) => {
    if (hasChanges.value) {
        if(!confirm('Discard unsaved changes?')) return;
    }
    
    selectedPrompt.value = prompt; // Set immediately for UI snap
    
    // Fetch full details
    try {
        const res = await api.get(`/prompts/${prompt.key}`);
        selectedPrompt.value = res.data.prompt;
        editBuffer.value = getCurrentContent(selectedPrompt.value);
        editDescription.value = selectedPrompt.value.description;
        changeLog.value = '';
    } catch (e) {
        console.error(e);
    }
};

const saveVersion = async () => {
    if (!changeLog.value) {
        // If no content changes, just description?
        if (editBuffer.value === getCurrentContent(selectedPrompt.value) && editDescription.value !== selectedPrompt.value.description) {
            // Probably just updating metadata if API supports it, but here we assume versioning flow.
            // Let's force a changelog if content changed.
            // If only description changed, we should probably allow saving without changelog logic but API might be version-based.
            // For MVP, we'll just require changelog for any save.
        }
    }
    
    if (!changeLog.value && editBuffer.value !== getCurrentContent(selectedPrompt.value)) {
         alert('Please enter a changelog description to save this version.');
         return;
    }

    saving.value = true;
    try {
        // We will send version update. Note: API needs to support description update during versioning or separate endpoint.
        // Assuming /versions only updates content. 
        // We really should update description too. 
        // Let's assume the backend 'updatePrompt' PUT /prompts/:key handles description, and POST /versions handles content.
        // We'll try to do both if needed.
        
        if (editDescription.value !== selectedPrompt.value.description) {
            // Update metadata
             await api.put(`/prompts/${selectedPrompt.value.key}`, {
                name: selectedPrompt.value.name,
                description: editDescription.value,
                isPublic: selectedPrompt.value.isPublic
            });
        }
        
        if (editBuffer.value !== getCurrentContent(selectedPrompt.value)) {
             await api.post(`/prompts/${selectedPrompt.value.key}/versions`, {
                content: editBuffer.value,
                changelog: changeLog.value || 'Update'
            });
        }
        
        // Refresh
        await selectPrompt(selectedPrompt.value);
        await fetchPrompts();
        alert('Saved!');
    } catch (e) {
        alert(e.response?.data?.error || 'Failed to save');
    } finally {
        saving.value = false;
    }
};

const activateScenario = () => {
    if (!selectedPrompt.value) return;
    chatStore.setScenario(selectedPrompt.value._id);
};

const deactivateScenario = () => {
    chatStore.setScenario(null);
};

const deleteScenario = async () => {
    if (!selectedPrompt.value) return;
    if (!confirm(`Are you sure you want to delete "${selectedPrompt.value.name}"? This cannot be undone.`)) return;

    try {
        await api.delete(`/prompts/${selectedPrompt.value._id}`); // Pass ID
        
        // If active, deactivate
        if (isActiveScenario(selectedPrompt.value._id)) {
            deactivateScenario();
        }

        selectedPrompt.value = null;
        await fetchPrompts();
    } catch (e) {
        alert(e.response?.data?.error || 'Deletion failed');
    }
};

const openCreateModal = () => { 
    newItem.value = { key: '', name: '', description: '', content: '', isPublic: false }; 
    showCreateModal.value = true; 
};
const closeCreateModal = () => { showCreateModal.value = false; };

const createPrompt = async () => {
    creating.value = true;
    try {
        const key = newItem.value.key || `scenario-${Date.now()}`;
        await api.post('/prompts', {
            type: 'scenario',
            key: key,
            name: newItem.value.name,
            description: newItem.value.description,
            content: newItem.value.content,
            isPublic: newItem.value.isPublic
        });
        await fetchPrompts();
        closeCreateModal();
    } catch (e) {
        alert(e.response?.data?.error || 'Creation failed');
    } finally {
        creating.value = false;
    }
};

const openPlayground = () => {
    testMessages.value = [];
    testInput.value = '';
    showPlayground.value = true;
};
const closePlayground = () => { showPlayground.value = false; };

const sendMessage = async () => {
    if (!testInput.value) return;
    const userMsg = testInput.value;
    testMessages.value.push({ role: 'user', content: userMsg });
    testInput.value = '';
    testing.value = true;
    
    try {
        const res = await api.post('/prompts/test', {
            systemContent: editBuffer.value, // Test with CURRENT buffer, not saved version
            userMessage: userMsg
        });
        
        let reply = '';
         if (typeof res.data === 'string') {
            reply = res.data;
        } else {
            reply = res.data.text || JSON.stringify(res.data);
        }

        testMessages.value.push({ role: 'assistant', content: reply }); 
    } catch (e) {
        testMessages.value.push({ role: 'assistant', content: 'Error: ' + e.message });
    } finally {
        testing.value = false;
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
.badge-public { background: #4f46e5; color: white; }

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
    display: flex;
    align-items: center;
    justify-content: center;
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
    display: flex;
    align-items: center;
    justify-content: center;
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
    width: 600px;
    max-width: 90%;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    max-height: 90vh;
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
    overflow-y: auto;
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
    color: var(--color-text-primary);
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

/* Playground Styles */
.playground-modal {
    width: 800px;
}

.chat-msg { display: flex; margin-bottom: 10px;}
.chat-msg.user { justify-content: flex-end; }
.chat-msg .bubble {
    max-width: 85%; padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.5;
}
.chat-msg.user .bubble { background: var(--color-accent); color: white; }
.chat-msg.assistant .bubble { background: var(--color-bg-tertiary); color: var(--color-text-primary); border: 1px solid var(--color-border); }
.typing { color: var(--color-text-muted); }



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

/* Mobile/Tablet Responsiveness */
@media (max-width: 1023px) {
    .page-container {
        padding: 16px;
    }
    
    .content-wrapper {
        position: relative;
        overflow: hidden;
        flex-direction: column;
    }

    /* Hide Sidebar completely on mobile, replaced by dropdown */
    .sidebar {
        display: none !important;
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
.bg-primary { background: var(--color-bg-primary, #121212); }
.bg-tertiary { background: var(--color-bg-tertiary, #2a2a2a); }
.border-color { border-color: var(--color-border, #374151); }
.text-muted { color: var(--color-text-muted, #9ca3af); }
.text-primary { color: var(--color-text-primary, #ffffff); }
</style>
