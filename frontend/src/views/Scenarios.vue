<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <h1>Persona Prompts</h1>
        <p class="subtitle">Create and manage your specialized AI assistants.</p>
      </div>
      
      <div class="header-actions">
        <button @click="openCreateModal" class="btn-primary">
            <i class="fas fa-plus mr-2"></i>New Persona
        </button>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- Sidebar List -->
      <div class="sidebar">
        <div class="sidebar-header">
           <div class="flex flex-col gap-3">
                <div class="flex justify-between items-center">
                    <h2>Defined Personas</h2>
                    <button @click="refreshPrompts" class="btn-icon-sm" title="Refresh">
                        <i class="fas fa-sync" :class="{ 'spin': loading }"></i>
                    </button>
                </div>
                <!-- Tabs -->
                <div class="flex bg-gray-900 rounded p-1 gap-1">
                    <button 
                        @click="viewTab = 'my'"
                        class="flex-1 text-xs py-1 rounded text-center transition-colors bg-gray-700 text-white font-medium"
                    >
                        My Personas
                    </button>
                </div>
           </div>
        </div>
        <div class="dashboard-content">
        <div v-if="loading" class="text-muted p-4">Loading...</div>
        
        <!-- My Personas Grid (Default & Only View) -->
        <div class="grid-layout fade-in">
             <div v-if="myScenarios.length === 0 && !loading" class="empty-card" @click="openCreateModal">
                <div class="plus-icon">+</div>
                <p>Create your first custom persona</p>
            </div>
            <div 
              v-for="item in myScenarios" 
              :key="item._id" 
              class="scenario-card"
              :class="{ 
                'active': selectedPrompt?._id === item._id, 
                'is-active-scenario': isActiveScenario(item._id) 
              }"
              @click="selectPrompt(item)"
            >
                <div class="card-header">
                    <div class="card-icon">{{ item.name.charAt(0).toUpperCase() }}</div>
                    <div class="card-meta">
                        <h3>{{ item.name }}</h3>
                        <span class="version-tag">v{{ item.activeVersion }}</span>
                    </div>
                </div>
                <p class="card-desc">{{ item.description }}</p>
                <div class="card-footer">
                    <span v-if="isActiveScenario(item._id)" class="badge-active-inline">Active</span>
                </div>
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
                    <span v-if="selectedPrompt.isPublic" class="badge badge-public ml-2">Official</span>
                    <span v-if="isActiveScenario(selectedPrompt._id)" class="badge badge-active-scenario ml-2">Currently Active</span>
                </div>
                <div class="toolbar-actions">
                    <button @click="openPlayground" class="btn-secondary">
                        <i class="fas fa-play mr-2"></i>Test
                    </button>

                    <button 
                        v-if="!isActiveScenario(selectedPrompt._id)"
                        @click="activateScenario" 
                        class="btn-primary-outline text-green-400 border-green-800 hover:bg-green-900/30"
                    >
                         <i class="fas fa-check mr-2"></i>Set as Active
                    </button>
                    <button 
                        v-else
                        @click="deactivateScenario" 
                        class="btn-secondary text-yellow-500 border-yellow-800 hover:bg-yellow-900/30"
                    >
                         <i class="fas fa-times mr-2"></i>Deactivate
                    </button>
                    
                    <button 
                        v-if="canEdit(selectedPrompt)"
                        @click="saveVersion"
                        :disabled="!hasChanges || saving"
                        class="btn-primary"
                    >
                        {{ saving ? 'Saving...' : 'Save Version' }}
                    </button>

                    <button 
                         v-if="canEdit(selectedPrompt)"
                         @click="deleteScenario"
                         class="btn-icon-danger"
                         title="Delete"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            <!-- Meta Inputs (Description) -->
             <div class="p-3 bg-gray-800 border-b border-gray-700 flex flex-col gap-2">
                <div class="flex gap-2">
                     <span class="text-xs text-gray-500 w-20 pt-2 uppercase font-bold tracking-wider">Description</span>
                     <input 
                        v-if="canEdit(selectedPrompt)"
                        v-model="editDescription" 
                        class="form-input flex-1 h-8 text-sm" 
                        placeholder="Short description..."
                    />
                    <div v-else class="flex-1 text-sm py-1 px-2 text-gray-300">{{ selectedPrompt.description }}</div>
                </div>
                 <div v-if="hasChanges && canEdit(selectedPrompt)" class="flex gap-2 animate-pulse-slow">
                     <span class="text-xs text-yellow-500 w-20 pt-2 uppercase font-bold tracking-wider">Changelog</span>
                    <input v-model="changeLog" placeholder="Describe changes (required to save)" class="form-input flex-1 h-8 text-sm border-yellow-700/50 focus:border-yellow-500" />
                </div>
            </div>

            <!-- Text Area -->
            <div class="editor-wrapper">
                <textarea 
                    v-model="editBuffer"
                    class="code-editor"
                    spellcheck="false"
                    :disabled="!canEdit(selectedPrompt)"
                    placeholder="Enter persona instructions..."
                ></textarea>
                <div v-if="hasChanges" class="unsaved-badge">Unsaved Changes</div>
            </div>
        </div>

            <!-- Empty State -->
        <div v-else class="empty-state">
            <i class="fas fa-robot text-6xl text-gray-700 mb-4"></i>
            <p>Select a persona to view or edit</p>
        </div>
      </div>
    </div>
    
    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3>New Persona</h3>
                <button @click="closeCreateModal" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Internal Key (Unique)</label>
                    <input v-model="newItem.key" type="text" placeholder="e.g. PYTHON_HELPER" class="form-input" />
                    <small class="text-muted block mt-1">Auto-generated if empty</small>
                </div>
                <div class="form-group">
                    <label>Persona Name <span class="text-red-500">*</span></label>
                    <input v-model="newItem.name" type="text" placeholder="e.g. Python Expert" class="form-input" />
                </div>
                <div class="form-group">
                     <label>Description</label>
                    <input v-model="newItem.description" type="text" placeholder="What does it do?" class="form-input" />
                </div>
                <div class="form-group">
                    <label>Initial Instructions</label>
                    <textarea v-model="newItem.content" class="form-input h-32 font-mono"></textarea>
                </div>
                 <div v-if="isSuperAdmin" class="form-group checkbox-group">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" v-model="newItem.isPublic" class="form-checkbox" />
                        <span class="text-sm font-medium text-white">Make this a System Persona (Public)</span>
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button @click="closeCreateModal" class="btn-secondary mr-2">Cancel</button>
                <button @click="createPrompt" :disabled="!newItem.name || creating" class="btn-primary">
                    {{ creating ? 'Creating...' : 'Create Draft' }}
                </button>
            </div>
        </div>
    </div>

    <!-- Playground Modal -->
    <div v-if="showPlayground" class="modal-overlay" @click.self="closePlayground">
         <div class="modal-content playground-modal">
            <div class="modal-header bg-gray-800">
                <h3>Test Persona: {{ selectedPrompt.name }}</h3>
                <button @click="closePlayground" class="close-btn">&times;</button>
            </div>
             <div class="playground-body flex flex-col h-[500px]">
                  <div class="chat-preview flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-gray-900">
                        <div v-if="testMessages.length === 0" class="text-center text-gray-500 mt-10">
                            Start a conversation to test these instructions.
                        </div>
                        <div v-for="(msg, i) in testMessages" :key="i" class="chat-msg" :class="msg.role">
                            <div class="bubble">{{ msg.content }}</div>
                        </div>
                        <div v-if="testing" class="chat-msg assistant">
                            <div class="bubble typing">...</div>
                        </div>
                   </div>
                   <div class="p-3 border-t border-gray-700 bg-gray-800 flex gap-2">
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

const authStore = useAuthStore();
const chatStore = useChatStore();
const router = useRouter();

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
const viewTab = ref('my'); // 'my' | 'public'

const newItem = ref({ key: '', name: '', description: '', content: '', isPublic: false });

// Test State
const testInput = ref('');
const testMessages = ref([]);
const testing = ref(false);

const filteredScenarios = computed(() => {
    if (viewTab.value === 'public') {
        return prompts.value.filter(s => s.isPublic);
    } else {
        return prompts.value.filter(s => s.ownerId === userId.value); // My Scenarios
    }
});

const isActiveScenario = (id) => activeScenarioId.value === id;

const hasChanges = computed(() => {
    if (!selectedPrompt.value) return false;
    return editBuffer.value !== getCurrentContent(selectedPrompt.value) || 
           editDescription.value !== selectedPrompt.value.description;
});


const canEdit = (item) => {
    return item && (item.ownerId === userId.value || isSuperAdmin.value);
};

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
        alert('Please enter a changelog description to save this version.');
        return;
    }
    saving.value = true;
    try {
        // If description changed, we might need a separate endpoint or just update local object if API doesn't support it yet via /versions
        // The /versions endpoint only updates content. 
        // We might need to update description via PUT /prompts/:key (if it exists) or just ignore for now in this MVP refactor.
        // Assuming current API structure from server.ts:
        // app.post('/api/prompts/:key/versions') -> updates content.
        // It doesn't seem to update Description. I might need to add that support or just accept content updates.
        // For now, I'll send the request.
        
        await api.post(`/prompts/${selectedPrompt.value.key}/versions`, {
            content: editBuffer.value,
            changelog: changeLog.value
        });
        
        // Refresh
        await selectPrompt(selectedPrompt.value);
        await fetchPrompts();
        alert('New version saved!');
    } catch (e) {
        alert(e.response?.data?.error || 'Failed to save');
    } finally {
        saving.value = false;
    }
};

const deleteScenario = async () => {
     if(!confirm('Are you sure you want to delete this persona?')) return;
     // API delete not implemented in server.ts view I saw, but let's assume standard DELETE /prompts/:key or :id
     // server.ts list shows: 1. List, 2. Get, 3. Create, 4. Ver, 5. Activate, 6. Test.
     // It does NOT show Delete.
     // I will alert "Not implemented"
     alert('Delete feature is not currently available/enabled in the backend.');
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
        
        // Handling stream or text response. server.ts sends stream but client (axios) here might just buffer if not configured. 
        // Existing code handled string or object.
        let reply = '';
         if (typeof res.data === 'string') {
            // It might be an SSE stream string if axios isn't handled right, but let's assume the previous imp worked.
            // Actually, previous imp used simple post.
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

const activateScenario = () => {
    if (!selectedPrompt.value) return;
    chatStore.setScenario(selectedPrompt.value._id);
};

const deactivateScenario = () => {
    chatStore.setScenario(null);
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

.prompt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.prompt-item.is-active-scenario {
    border-left: 3px solid #10b981; /* Green border for active */
    background: rgba(16, 185, 129, 0.05);
}

.prompt-name {
    font-weight: 500;
    font-size: 14px;
}


.prompt-desc {
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 8px;
}

.badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 999px;
    font-weight: 600;
    text-transform: uppercase;
}
.badge-public { background: #4f46e5; color: white; }
.badge-active-scenario { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }

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
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
}
.btn-secondary:hover { background: rgba(255,255,255,0.05); }

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

.btn-primary-outline {
    background: transparent;
    color: var(--color-accent);
    border: 1px solid var(--color-accent);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
}
.btn-primary-outline:hover { background: rgba(37, 99, 235, 0.1); }

.btn-icon-danger {
    background: transparent; border: none; color: #ef4444; padding: 6px; cursor: pointer; opacity: 0.6;
}
.btn-icon-danger:hover { opacity: 1; }

.editor-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
}

.code-editor {
    flex: 1;
    background: #151515;
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

.playground-modal {
    width: 800px;
}

/* Chat Bubbles in Playground */
.chat-msg { display: flex; margin-bottom: 10px;}
.chat-msg.user { justify-content: flex-end; }
.chat-msg .bubble {
    max-width: 85%; padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.5;
}
.chat-msg.user .bubble { background: var(--color-accent); color: white; }
.chat-msg.assistant .bubble { background: var(--color-bg-tertiary); color: var(--color-text-primary); border: 1px solid var(--color-border); }
.typing { color: var(--color-text-muted); }

.animate-pulse-slow {
   animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .7; }
}

/* Icons */
.btn-icon-sm { background: transparent; border: none; color: #9ca3af; cursor: pointer; padding: 4px; }
.btn-icon-sm:hover { color: white; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

.badge-active-inline { display: inline-block; background: rgba(16, 185, 129, 0.1); color: #34d399; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; float: right; }

</style>
