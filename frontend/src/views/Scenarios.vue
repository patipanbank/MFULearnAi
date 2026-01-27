<template>
  <div class="scenarios-dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>Persona Library</h1>
        <p class="subtitle">Create and manage your specialized AI assistants.</p>
      </div>
      
      <div class="header-actions">
        <button @click="openCreateModal" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Create Persona
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button 
        class="tab-btn" 
        :class="{ active: viewTab === 'my' }"
        @click="viewTab = 'my'"
      >
        My Personas
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: viewTab === 'public' }"
        @click="viewTab = 'public'"
      >
        System Personas
      </button>
    </div>

    <div class="dashboard-content">
        <div v-if="loading" class="text-muted p-4">Loading...</div>
        
        <!-- My Personas Grid -->
        <div v-if="viewTab === 'my'" class="grid-layout fade-in">
             <div v-if="myScenarios.length === 0 && !loading" class="empty-card" @click="openCreateModal">
                <div class="plus-icon">+</div>
                <p>Create your first custom persona</p>
            </div>
            <div 
                v-for="item in myScenarios" 
                :key="item._id" 
                class="scenario-card"
                :class="{ 'active': selectedScenario?._id === item._id }"
                @click="openScenario(item)"
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
                    <span>{{ formatDate(item.updatedAt) }}</span>
                </div>
            </div>
        </div>

        <!-- Public Personas Grid -->
        <div v-if="viewTab === 'public'" class="grid-layout fade-in">
             <div 
                v-for="item in publicScenarios" 
                :key="item._id" 
                class="scenario-card system-card"
                :class="{ 'active': selectedScenario?._id === item._id }"
                @click="openScenario(item)"
            >
                <div class="card-header">
                    <div class="card-icon system-icon">S</div>
                    <div class="card-meta">
                        <h3>{{ item.name }}</h3>
                        <span class="badge-public">OFFICIAL</span>
                    </div>
                </div>
                <p class="card-desc">{{ item.description }}</p>
            </div>
        </div>
    </div>

    <!-- Detail/Playground Modal -->
    <Teleport to="body">
        <div v-if="selectedScenario" class="modal-overlay" @click.self="closeScenario">
            <div class="detail-modal">
                <div class="modal-header">
                    <div class="header-title">
                        <h2>{{ selectedScenario.name }}</h2>
                        <span v-if="selectedScenario.isPublic" class="badge-public ml-2">OFFICIAL</span>
                    </div>
                    <button @click="closeScenario" class="close-btn">&times;</button>
                </div>
                
                <div class="modal-body-split">
                    <!-- Left: Config/Edit -->
                    <div class="split-left">
                        <div class="tabs small-tabs">
                             <button 
                                class="tab-btn" 
                                :class="{ active: detailTab === 'info' }"
                                @click="detailTab = 'info'"
                              >
                                Info & Prompt
                              </button>
                        </div>
                        <div class="config-content">
                            <div class="form-group">
                                <label>Description</label>
                                <input v-if="canEdit(selectedScenario)" v-model="editDescription" class="form-input" />
                                <div v-else class="read-only-text">{{ selectedScenario.description }}</div>
                            </div>
                            <div class="form-group flex-1 flex flex-col">
                                <label>Instructions (System Prompt)</label>
                                <textarea 
                                    v-if="canEdit(selectedScenario)"
                                    v-model="editContent" 
                                    class="code-editor" 
                                    spellcheck="false"
                                ></textarea>
                                <pre v-else class="code-preview">{{ getCurrentContent(selectedScenario) }}</pre>
                            </div>
                            
                            <div v-if="canEdit(selectedScenario)" class="actions-row">
                                <button @click="deleteScenario" class="btn-text-danger">Delete</button>
                                <button @click="saveChanges" :disabled="!hasChanges || saving" class="btn-primary">
                                    {{ saving ? 'Saving...' : 'Save Changes' }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Playground -->
                    <div class="split-right">
                        <div class="playground-header">Playground</div>
                        <div class="chat-preview">
                            <div v-if="testMessages.length === 0" class="empty-chat-state">
                                Test your persona here.
                            </div>
                            <div v-for="(msg, i) in testMessages" :key="i" class="chat-msg" :class="msg.role">
                                <div class="bubble">{{ msg.content }}</div>
                            </div>
                            <div v-if="testing" class="chat-msg assistant">
                                <div class="bubble typing">...</div>
                            </div>
                        </div>
                        <div class="chat-input-area">
                            <input 
                                v-model="testInput" 
                                @keyup.enter="sendMessage"
                                placeholder="Type a message..." 
                                class="chat-input"
                            />
                            <button @click="sendMessage" :disabled="!testInput || testing" class="btn-send">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- Create Modal -->
    <Teleport to="body">
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>New Persona</h3>
                <button @click="closeCreateModal" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Persona Name</label>
                    <input v-model="newItem.name" type="text" placeholder="e.g. Python Helper" class="form-input" />
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <input v-model="newItem.description" type="text" placeholder="What does it do?" class="form-input" />
                </div>
                <div class="form-group">
                    <label>Instructions</label>
                    <textarea v-model="newItem.content" class="form-input h-32" placeholder="You are a helpful assistant who..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button @click="closeCreateModal" class="btn-secondary mr-2">Cancel</button>
                <button @click="createScenario" :disabled="!newItem.name || creating" class="btn-primary">
                    {{ creating ? 'Creating...' : 'Create' }}
                </button>
            </div>
        </div>
    </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../utils/api'; 
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const userId = computed(() => authStore.userId);

const loading = ref(false);
const scenarios = ref([]);
const selectedScenario = ref(null);
const viewTab = ref('my'); // 'my' | 'public'
const detailTab = ref('info');

const showCreateModal = ref(false);

// Edit State
const editContent = ref('');
const editDescription = ref('');
const saving = ref(false);

// Test State
const testInput = ref('');
const testMessages = ref([]);
const testing = ref(false);

// Create State
const creating = ref(false);
const newItem = ref({ name: '', description: '', content: '' });

// Computeds
const myScenarios = computed(() => scenarios.value.filter(s => s.ownerId === userId.value));
const publicScenarios = computed(() => scenarios.value.filter(s => s.isPublic));

const hasChanges = computed(() => {
    if (!selectedScenario.value) return false;
    const currentVerContent = getCurrentContent(selectedScenario.value);
    return editContent.value !== currentVerContent || editDescription.value !== selectedScenario.value.description;
});

const canEdit = (item) => {
    return item.ownerId === userId.value || (authStore.role === 'superadmin'); 
};

const getCurrentContent = (prompt) => {
    if (!prompt.versions) return '';
    const v = prompt.versions.find(ver => ver.version === prompt.activeVersion);
    return v ? v.content : '';
};

const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Actions
const fetchScenarios = async () => {
    loading.value = true;
    try {
        const res = await api.get('/prompts?type=scenario');
        scenarios.value = res.data.prompts || [];
    } catch (e) {
        console.error(e);
        scenarios.value = [];
    } finally {
        loading.value = false;
    }
};

const openScenario = async (item) => {
    try {
        const res = await api.get(`/prompts/${item.key}`);
        selectedScenario.value = res.data.prompt;
        
        editContent.value = getCurrentContent(selectedScenario.value);
        editDescription.value = selectedScenario.value.description;
        testMessages.value = [];
    } catch (e) {
        console.error(e);
    }
};

const closeScenario = () => { selectedScenario.value = null; };

const saveChanges = async () => {
    saving.value = true;
    try {
        if (editContent.value !== getCurrentContent(selectedScenario.value)) {
             await api.post(`/prompts/${selectedScenario.value.key}/versions`, {
                content: editContent.value,
                changelog: 'Updated via UI'
            });
        }
        await fetchScenarios();
        await openScenario(selectedScenario.value); // refresh details
        alert('Saved!');
    } catch (e) {
        alert('Failed: ' + e.message);
    } finally {
        saving.value = false;
    }
};

const openCreateModal = () => { newItem.value = {name:'', description:'', content:''}; showCreateModal.value = true; };
const closeCreateModal = () => { showCreateModal.value = false; };

const createScenario = async () => {
    creating.value = true;
    try {
        const key = `scenario-${Date.now()}`; 
        await api.post('/prompts', {
            type: 'scenario',
            key: key,
            name: newItem.value.name,
            description: newItem.value.description,
            content: newItem.value.content || ' '
        });
        await fetchScenarios();
        closeCreateModal();
    } catch (e) {
        alert('Failed: ' + e.message);
    } finally {
        creating.value = false;
    }
};

const deleteScenario = async () => {
    if(!confirm('Delete this persona?')) return;
    alert('Delete not implemented yet.');
};

const sendMessage = async () => {
    if (!testInput.value) return;
    const userMsg = testInput.value;
    testMessages.value.push({ role: 'user', content: userMsg });
    testInput.value = '';
    testing.value = true;
    
    try {
        const res = await api.post('/prompts/test', {
            systemContent: editContent.value,
            userMessage: userMsg
        });
        
        let reply = '';
        if(typeof res.data === 'string') reply = res.data;
        else reply = res.data.text || JSON.stringify(res.data);

        testMessages.value.push({ role: 'assistant', content: reply }); 
    } catch (e) {
        testMessages.value.push({ role: 'assistant', content: 'Error: ' + e.message });
    } finally {
        testing.value = false;
    }
};

onMounted(() => fetchScenarios());
</script>

<style scoped>
.scenarios-dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
  background: var(--color-bg-primary); /* Ensure background is set */
}

/* Header matched to KnowledgeDashboard */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 4px 0;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 14px;
}

.btn-primary {
  display: flex; align-items: center; gap: 8px; padding: 8px 16px;
  background: var(--color-accent); color: white; border: none; border-radius: 8px;
  font-weight: 500; cursor: pointer; transition: opacity 0.2s;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; }

.btn-secondary {
    padding: 8px 16px; background: transparent; color: var(--color-text-primary);
    border: 1px solid var(--color-border); border-radius: 8px; font-weight: 500; cursor: pointer;
}
.btn-secondary:hover { background: var(--color-bg-hover); }

/* Tabs matched to KnowledgeDashboard */
.tabs {
  display: flex; gap: 2px;
  background: var(--color-bg-tertiary);
  padding: 4px 4px 0 4px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0;
  border-radius: 8px 8px 0 0;
}

.tab-btn {
  padding: 10px 24px; background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--color-text-muted); font-weight: 500; font-size: 14px; cursor: pointer;
  transition: all 0.2s; border-radius: 6px 6px 0 0;
}

.tab-btn:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }
.tab-btn.active {
  color: var(--color-accent); background: var(--color-bg-secondary); border-bottom: 2px solid var(--color-accent);
}

/* Content Area matched to KnowledgeDashboard */
.dashboard-content {
  flex: 1;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 12px 12px;
  padding: 24px;
  overflow-y: auto;
}

.fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Grid & Cards matched styles */
.grid-layout {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;
}

.scenario-card {
    background: var(--color-bg-primary); /* Inner card contrast */
    border: 1px solid var(--color-border);
    border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s;
    height: 160px; display: flex; flex-direction: column;
}
.scenario-card:hover { border-color: var(--color-accent); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

.card-header { display: flex; gap: 12px; margin-bottom: 12px; }
.card-icon {
    width: 40px; height: 40px; background: var(--color-bg-tertiary); border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 18px; color: var(--color-text-primary);
}
.system-icon { background: #4f46e5; color: white; }

.card-meta h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.version-tag { font-size: 10px; background: var(--color-bg-tertiary); padding: 2px 6px; border-radius: 4px; color: var(--color-text-muted); }
.badge-public { font-size: 10px; background: #4f46e5; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; }

.card-desc { font-size: 13px; color: var(--color-text-secondary); flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; margin: 0; line-height: 1.5; }
.card-footer { margin-top: 12px; font-size: 11px; color: var(--color-text-muted); text-align: right; }

.empty-card {
    border: 2px dashed var(--color-border); border-radius: 12px; height: 160px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; color: var(--color-text-muted); transition: all 0.2s;
}
.empty-card:hover { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-bg-hover); }
.plus-icon { font-size: 32px; margin-bottom: 8px; }

/* Detail Modal (Overlay) */
.modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; z-index: 1000;
    animation: fadeIn 0.2s ease-out;
}

/* Detail Modal specific */
.detail-modal {
    width: 90vw; max-width: 1000px; height: 85vh;
    background: var(--color-bg-secondary); border: 1px solid var(--color-border);
    border-radius: 16px; display: flex; flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    overflow: hidden;
}

.modal-header {
    padding: 16px 24px; border-bottom: 1px solid var(--color-border);
    display: flex; justify-content: space-between; align-items: center;
    background: var(--color-bg-tertiary);
}
.header-title h2 { margin: 0; font-size: 20px; color: var(--color-text-primary); display: inline-block;}
.close-btn { background: none; border: none; font-size: 24px; color: var(--color-text-muted); cursor: pointer; }

.modal-body-split {
    flex: 1; display: flex; overflow: hidden;
}

.split-left {
    flex: 1; display: flex; flex-direction: column;
    border-right: 1px solid var(--color-border);
    padding: 0; background: var(--color-bg-secondary);
}
.split-right {
    flex: 1; display: flex; flex-direction: column;
    background: var(--color-bg-primary); 
    padding: 0;
}

/* Config Content */
.config-content {
    flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto;
}
.small-tabs {
    border-radius: 0; margin-bottom: 0;
}
.form-group label { display: block; font-size: 13px; font-weight:600; color: var(--color-text-secondary); margin-bottom: 6px; }
.form-input {
    width: 100%; background: var(--color-bg-primary); border: 1px solid var(--color-border);
    padding: 10px; color: var(--color-text-primary); border-radius: 6px;
}
.code-editor {
    width: 100%; flex: 1; min-height: 200px;
    background: #111; color: #e5e7eb; padding: 16px;
    font-family: 'Fira Code', monospace; border: 1px solid var(--color-border); border-radius: 6px;
    resize: none; font-size: 13px; line-height: 1.5;
}
.read-only-text { color: var(--color-text-primary); padding: 10px 0; }
.code-preview {
    background: #111; padding: 16px; border-radius: 6px; overflow: auto; flex: 1; font-family: monospace; font-size: 12px;
}

.actions-row { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 16px; border-top: 1px solid var(--color-border); }
.btn-text-danger { background: none; border: none; color: #ef4444; font-size: 13px; cursor: pointer; }

/* Playground */
.playground-header {
    padding: 12px 16px; font-weight: 600; color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border); background: var(--color-bg-tertiary); text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em;
}

.chat-preview {
    flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;
}
.empty-chat-state {
    flex: 1; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); font-size: 14px;
}

.chat-msg { display: flex; }
.chat-msg.user { justify-content: flex-end; }
.chat-msg .bubble {
    max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5;
}
.chat-msg.user .bubble { background: var(--color-accent); color: white; }
.chat-msg.assistant .bubble { background: var(--color-bg-tertiary); color: var(--color-text-primary); border: 1px solid var(--color-border); }
.typing { color: var(--color-text-muted); }

.chat-input-area {
    padding: 16px; border-top: 1px solid var(--color-border); display: flex; gap: 10px; background: var(--color-bg-secondary);
}
.chat-input {
    flex: 1; background: var(--color-bg-primary); border: 1px solid var(--color-border);
    padding: 12px; color: var(--color-text-primary); border-radius: 24px; outline: none;
}
.chat-input:focus { border-color: var(--color-accent); }
.btn-send {
    background: var(--color-accent); color: white; border: none; width: 42px; height: 42px;
    border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.btn-send:disabled { opacity: 0.5; }

/* Reused Modal (Create) */
.modal-content {
    background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 12px; width: 450px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}
.modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.modal-footer { padding: 16px 24px; background: var(--color-bg-tertiary); display: flex; justify-content: flex-end; border-radius: 0 0 12px 12px; }

</style>
