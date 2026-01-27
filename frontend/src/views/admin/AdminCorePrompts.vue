<template>
  <div class="prompt-manager">
    <!-- 1. Top Navigation / Header -->
    <header class="manager-header">
      <div class="header-content">
        <div class="header-title">
          <h1>System Prompts</h1>
          <span class="badge-count">{{ prompts.length }}</span>
        </div>
        <div class="header-actions">
           <button v-if="isSuperAdmin" @click="openCreateModal" class="btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Prompt
          </button>
        </div>
      </div>
    </header>

    <!-- 2. Main Layout (Master-Detail) -->
    <main class="manager-body">
      
      <!-- A. Sidebar List (Master) -->
      <aside class="sidebar-list">
        <!-- Search / Filter (Optional placeholder) -->
        <div class="list-controls">
           <input type="text" placeholder="Search prompts..." class="search-input" disabled title="Filter coming soon" />
        </div>

        <div class="list-scroll">
            <div v-if="loading" class="p-4 text-center text-muted text-sm">Loading...</div>
            <div v-else-if="prompts.length === 0" class="p-4 text-center text-muted text-sm">No prompts found.</div>

            <button 
              v-for="prompt in prompts" 
              :key="prompt._id"
              @click="selectPrompt(prompt)"
              class="list-item"
              :class="{ 'selected': selectedPrompt?._id === prompt._id }"
            >
              <div class="item-main">
                <span class="item-name">{{ prompt.name }}</span>
                <span v-if="prompt.isActive" class="status-indicator"></span>
              </div>
              <div class="item-meta">
                <div class="tags">
                   <span v-for="tag in prompt.tags" :key="tag" class="tag">{{ tag }}</span>
                </div>
                <span class="version">v{{ prompt.activeVersion }}</span>
              </div>
            </button>
        </div>
      </aside>

      <!-- B. Editor Area (Detail) -->
      <section class="editor-pane">
        <div v-if="selectedPrompt" class="editor-inner">
            <!-- Toolbar -->
            <div class="editor-header">
                <div class="editor-meta">
                   <h2 class="preview-title">{{ selectedPrompt.name }}</h2>
                   <code class="preview-key">{{ selectedPrompt.key }}</code>
                   <span v-if="selectedPrompt.isActive" class="badge-status active">Active</span>
                </div>
                <div class="editor-actions">
                    <button 
                        v-if="isSuperAdmin && !selectedPrompt.isActive"
                        @click="activatePrompt"
                        :disabled="activating"
                        class="btn-text-action text-success"
                    >
                        {{ activating ? 'Activating...' : 'Set Active' }}
                    </button>
                    <div class="divider-vertical"></div>
                    <button 
                        v-if="isSuperAdmin"
                        @click="saveVersion"
                        :disabled="!hasChanges || saving"
                        class="btn-primary btn-sm"
                    >
                        {{ saving ? 'Saving...' : 'Save Changes' }}
                    </button>
                </div>
            </div>

            <!-- Change Log Input (Conditional) -->
             <div v-if="hasChanges" class="changelog-bar">
                <input v-model="changeLog" placeholder="Reason for change (Required to save)" class="changelog-input" />
             </div>

            <!-- The Editor -->
            <div class="code-wrapper">
                <textarea 
                    v-model="editBuffer"
                    class="monaco-like-editor"
                    spellcheck="false"
                    :disabled="!isSuperAdmin"
                ></textarea>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-placeholder">
            <div class="placeholder-content">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-4 text-muted"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                <p>Select a prompt from the list to edit</p>
            </div>
        </div>
      </section>

    </main>

    <!-- Modal (Reused Logic) -->
    <div v-if="showCreateModal" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3>Create New Prompt</h3>
                <button @click="closeCreateModal" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <label>Internal Key</label>
                    <input v-model="newItem.key" placeholder="e.g. DINDIN_V3_TEST" class="input-std" />
                    <p class="input-hint">Must be unique. Format: NAME_ENV</p>
                </div>
                <div class="form-row">
                    <label>Display Name</label>
                    <input v-model="newItem.name" placeholder="e.g. DinDin Version 3 (Test)" class="input-std" />
                </div>
                 <div class="form-row">
                    <label>Initial Prompt</label>
                    <textarea v-model="newItem.content" class="input-std input-area"></textarea>
                </div>
            </div>
            <div class="modal-actions">
                <button @click="closeCreateModal" class="btn-ghost">Cancel</button>
                <button @click="createPrompt" :disabled="!newItem.key || creating" class="btn-primary">Create</button>
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

// Data
const prompts = ref([]);
const loading = ref(false);
const saving = ref(false);
const activating = ref(false);
const creating = ref(false);

// Selection
const selectedPrompt = ref(null);
const editBuffer = ref('');
const changeLog = ref('');

// Create Modal
const showCreateModal = ref(false);
const newItem = ref({ key: '', name: '', content: '' });

// Computed
const hasChanges = computed(() => {
    if (!selectedPrompt.value) return false;
    return editBuffer.value !== getCurrentContent(selectedPrompt.value);
});

// Helpers
const getCurrentContent = (prompt) => {
    if (!prompt || !prompt.versions) return '';
    const v = prompt.versions.find(ver => ver.version === prompt.activeVersion);
    return v ? v.content : (prompt.versions[0]?.content || '');
};

// API Actions
const fetchPrompts = async () => {
    loading.value = true;
    try {
        const res = await api.get('/prompts?type=core');
        prompts.value = res.data.prompts || [];
    } catch (e) { console.error(e); } 
    finally { loading.value = false; }
};

const selectPrompt = async (prompt) => {
    if (hasChanges.value && !confirm('Discard unsaved changes?')) return;
    
    // Optimistic UI update
    const previous = selectedPrompt.value; 
    selectedPrompt.value = prompt; // Show shell immediately

    try {
        const res = await api.get(`/prompts/${prompt.key}`);
        selectedPrompt.value = res.data.prompt;
        editBuffer.value = getCurrentContent(selectedPrompt.value);
        changeLog.value = '';
    } catch (e) {
        alert('Failed to load details');
        selectedPrompt.value = previous; // Revert
    }
};

const saveVersion = async () => {
    if (!changeLog.value) return alert('Changelog required');
    saving.value = true;
    try {
        await api.post(`/prompts/${selectedPrompt.value.key}/versions`, {
            content: editBuffer.value,
            changelog: changeLog.value
        });
        await selectPrompt(selectedPrompt.value); // Refresh
        await fetchPrompts(); // Update list indicators
        alert('Saved!');
    } catch (e) { alert('Save failed'); }
    finally { saving.value = false; }
};

const activatePrompt = async () => {
    if(!confirm('Activate this prompt?')) return;
    activating.value = true;
    try {
        await api.post(`/prompts/${selectedPrompt.value.key}/activate`);
        selectedPrompt.value.isActive = true;
        await fetchPrompts();
    } catch (e) { alert('Failed'); }
    finally { activating.value = false; }
};

const createPrompt = async () => {
    creating.value = true;
    try {
        await api.post('/prompts', { ...newItem.value, type: 'core' });
        await fetchPrompts();
        closeCreateModal();
    } catch (e) { alert('Failed'); }
    finally { creating.value = false; }
};

// Modal Controls
const openCreateModal = () => { newItem.value = { key:'', name:'', content:'' }; showCreateModal.value = true; };
const closeCreateModal = () => showCreateModal.value = false;

onMounted(fetchPrompts);
</script>

<style scoped>
/* 
    DESIGN ARCHITECTURE:
    - CSS Grid for top-level layout (Header + Body).
    - Flex Row for Master-Detail (Sidebar + Main).
    - CSS Variables for all colors.
    - No nested scrolling issues (flex-1 + overflow-hidden on parents).
*/

.prompt-manager {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: 'Inter', -apple-system, sans-serif; /* Ensure modern font */
}

/* --- HEADER --- */
.manager-header {
    height: 60px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 24px;
    background: var(--color-bg-primary);
}
.header-content {
    width: 100%;
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
}
.header-title { display: flex; align-items: center; gap: 12px; }
.header-title h1 { margin: 0; font-size: 18px; font-weight: 600; color: var(--color-text-primary); }
.badge-count { 
    background: var(--color-bg-tertiary); color: var(--color-text-muted); 
    font-size: 12px; padding: 2px 8px; border-radius: 99px; font-weight: 600; 
}

/* --- MAIN BODY --- */
.manager-body {
    flex: 1;
    display: flex;
    overflow: hidden; /* Lock viewport */
}

/* --- SIDEBAR LIST --- */
.sidebar-list {
    width: 280px;
    border-right: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}

.list-controls {
    padding: 12px;
    border-bottom: 1px solid var(--color-border);
}
.search-input {
    width: 100%; background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
    padding: 8px 12px; border-radius: 6px; color: var(--color-text-primary); font-size: 13px;
}
.search-input:focus { outline: none; border-color: var(--color-accent); }

.list-scroll {
    flex: 1; overflow-y: auto; padding: 8px;
    display: flex; flex-direction: column; gap: 4px;
}

.list-item {
    text-align: left;
    background: transparent; border: 1px solid transparent;
    padding: 10px 12px; border-radius: 8px;
    cursor: pointer; transition: all 0.2s;
    outline: none;
}
.list-item:hover { background: var(--color-bg-hover); }
.list-item.selected { 
    background: var(--color-bg-tertiary); 
    border-color: var(--color-border);
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.item-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.item-name { font-weight: 500; font-size: 14px; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status-indicator { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 4px rgba(16,185,129,0.5); }

.item-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--color-text-secondary); }
.tag { background: rgba(59,130,246,0.1); color: #3b82f6; padding: 1px 4px; border-radius: 4px; margin-right: 4px; }
.version { font-family: monospace; }

/* --- EDITOR PANE --- */
.editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1e1e1e; /* Dedicated dark theme for editor area */
}

/* Editor Toolbar */
.editor-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.editor-header {
    height: 56px;
    border-bottom: 1px solid #333;
    background: #1e1e1e;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    flex-shrink: 0;
}

.editor-meta { display: flex; align-items: center; gap: 12px; }
.preview-title { margin: 0; font-size: 16px; font-weight: 600; color: #fff; }
.preview-key { font-size: 12px; color: #888; background: #2a2a2a; padding: 2px 6px; border-radius: 4px; }
.badge-status.active { font-size: 10px; background: rgba(16,185,129,0.2); color: #34d399; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; font-weight: 700; }

.editor-actions { display: flex; align-items: center; gap: 12px; }
.btn-text-action { background: none; border: none; font-size: 13px; font-weight: 500; cursor: pointer; }
.text-success { color: #34d399; } .text-success:hover { text-decoration: underline; }
.divider-vertical { width: 1px; height: 16px; background: #444; }

.changelog-bar {
    padding: 8px 20px;
    background: #252525;
    border-bottom: 1px solid #333;
}
.changelog-input {
    width: 100%; border: 1px solid #444; background: #1a1a1a; color: #ddd;
    padding: 6px 10px; border-radius: 4px; font-size: 12px;
}
.changelog-input:focus { border-color: #3b82f6; outline: none; }

.code-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
}
.monaco-like-editor {
    width: 100%; height: 100%;
    background: #1e1e1e; color: #d4d4d4;
    border: none; padding: 24px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 14px; line-height: 1.6;
    outline: none; resize: none;
}

/* Empty State */
.empty-placeholder {
    flex: 1; display: flex; align-items: center; justify-content: center;
    background: var(--color-bg-primary); /* Use theme bg for empty state */
}
.placeholder-content { text-align: center; color: var(--color-text-muted); }

/* --- RESPONSIVE ADJUSTMENTS --- */
@media (max-width: 768px) {
    .manager-body { flex-direction: column; overflow-y: auto; }
    .sidebar-list { width: 100%; height: 250px; border-right: none; border-bottom: 1px solid var(--color-border); }
    .editor-pane { height: 600px; /* Fixed height editor on mobile */ }
}

/* --- BUTTONS & UTILS --- */
.btn-primary { 
    background: var(--color-accent); color: white; border: none; padding: 8px 16px; border-radius: 6px; 
    font-weight: 500; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; }
.btn-sm { padding: 4px 12px; font-size: 12px; }

.btn-ghost { background: transparent; border: none; color: var(--color-text-secondary); cursor: pointer; }
.btn-ghost:hover { color: var(--color-text-primary); }

.text-muted { color: var(--color-text-muted); }
.text-sm { font-size: 13px; }

/* MODAL STYLES */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal-card { width: 440px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden; }
.modal-header { padding: 16px 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; background: var(--color-bg-tertiary); }
.modal-header h3 { margin: 0; font-size: 16px; color: var(--color-text-primary); }
.btn-close { background: none; border: none; font-size: 20px; color: var(--color-text-muted); cursor: pointer; }
.modal-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; }
.form-row label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--color-text-secondary); }
.input-std { width: 100%; background: var(--color-bg-primary); border: 1px solid var(--color-border); padding: 10px; border-radius: 6px; color: var(--color-text-primary); }
.input-std:focus { outline: none; border-color: var(--color-accent); }
.input-area { height: 100px; resize: none; font-family: monospace; }
.input-hint { font-size: 11px; color: var(--color-text-muted); margin-top: 4px; }
.modal-actions { padding: 16px 20px; background: var(--color-bg-tertiary); display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--color-border); }
</style>
