<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <h1>Departments</h1>
        <p class="subtitle">Manage university departments. These are also auto-created from SSO logins.</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <span class="icon">+</span> Create Department
      </button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Created At</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
           <tr v-if="loading && departments.length === 0">
               <td colspan="4" class="empty-row">Loading...</td>
           </tr>
           <tr v-else-if="departments.length === 0">
               <td colspan="4" class="empty-row">No departments found.</td>
           </tr>
           <tr v-for="dept in departments" :key="dept._id" class="clickable-row" @click="openEditModal(dept)">
             <td class="col-code">
               <span class="badge badge-dept">{{ dept.code }}</span>
             </td>
             <td class="font-medium">{{ dept.name }}</td>
             <td class="text-muted">{{ formatDate(dept.createdAt) }}</td>
             <td class="actions-cell">
                 <button class="btn-icon" @click.stop="openEditModal(dept)" title="Edit">
                    ✏️
                 </button>
                 <button class="btn-icon delete" @click.stop="handleDelete(dept._id)" title="Delete">
                    🗑️
                 </button>
             </td>
           </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <Teleport to="body">
       <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
          <div class="knowledge-modal">
             <h2>{{ isEditing ? 'Edit Department' : 'Create Department' }}</h2>
             
             <div class="form-group">
                 <label>Department Name</label>
                 <input v-model="form.name" type="text" placeholder="e.g. School of IT" ref="nameInput">
             </div>

             <div class="form-group" v-if="!isEditing">
                 <label>Code (Optional)</label>
                 <input v-model="form.code" type="text" placeholder="Auto-generated if empty">
                 <p class="hint">Unique identifier used for mapping.</p>
             </div>

             <div v-if="error" class="error">{{ error }}</div>

             <div class="actions">
                 <button class="btn-cancel" @click="closeModal">Cancel</button>
                 <button class="btn-primary" @click="handleSubmit" :disabled="submitting || !form.name">
                     {{ submitting ? 'Saving...' : 'Save' }}
                 </button>
             </div>
          </div>
       </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import api from '../../utils/api';

const departments = ref([]);
const loading = ref(false);
const showModal = ref(false);
const submitting = ref(false);
const isEditing = ref(false);
const error = ref(null);
const nameInput = ref(null);

const form = ref({
    _id: null,
    name: '',
    code: ''
});

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fetchDepartments = async () => {
    loading.value = true;
    try {
        const response = await api.get('/departments');
        departments.value = response.data.departments || [];
    } catch (err) {
        console.error('Failed to fetch departments:', err);
    } finally {
        loading.value = false;
    }
};

const openCreateModal = () => {
    isEditing.value = false;
    form.value = { _id: null, name: '', code: '' };
    error.value = null;
    showModal.value = true;
    nextTick(() => nameInput.value?.focus());
};

const openEditModal = (dept) => {
    isEditing.value = true;
    form.value = { ...dept };
    error.value = null;
    showModal.value = true;
     nextTick(() => nameInput.value?.focus());
};

const closeModal = () => {
    showModal.value = false;
};

const handleSubmit = async () => {
    if (!form.value.name) return;
    
    submitting.value = true;
    error.value = null;

    try {
        if (isEditing.value) {
            await api.put(`/departments/${form.value._id}`, { name: form.value.name });
        } else {
            await api.post('/departments', { name: form.value.name, code: form.value.code });
        }
        await fetchDepartments();
        closeModal();
    } catch (err) {
        error.value = err.response?.data?.error || err.message || 'Operation failed';
    } finally {
        submitting.value = false;
    }
};

const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this department? Users assigned to it might lose their mapping.')) return;
    
    try {
        await api.delete(`/departments/${id}`);
        departments.value = departments.value.filter(d => d._id !== id);
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete');
    }
};

onMounted(() => {
    fetchDepartments();
});
</script>

<style scoped>
.page-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: var(--color-bg-primary, #121212); /* Fallback */
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

/* Buttons */
.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-accent, #3b82f6);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-cancel {
    background: transparent;
    color: var(--color-text-secondary, #d1d5db);
    border: 1px solid var(--color-border, #374151);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
}
.btn-cancel:hover { background: var(--color-bg-tertiary, #2a2a2a); }

.btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    opacity: 0.7;
    transition: opacity 0.2s;
}
.btn-icon:hover { opacity: 1; }
.btn-icon.delete:hover { filter: brightness(0.8); }

/* Table */
.table-container {
  background: var(--color-bg-secondary, #1e1e1e);
  border: 1px solid var(--color-border, #374151);
  border-radius: 12px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th, .data-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #374151);
}

.data-table th {
  color: var(--color-text-muted, #9ca3af);
  font-weight: 500;
  font-size: 13px;
  background: var(--color-bg-tertiary, #252525);
  text-transform: uppercase;
}

.clickable-row:hover {
    background: var(--color-bg-tertiary, #2a2a2a);
    cursor: pointer;
}

.empty-row {
    text-align: center;
    color: var(--color-text-muted);
    padding: 32px;
}

.text-right { text-align: right; }
.actions-cell { text-align: right; display: flex; gap: 8px; justify-content: flex-end; }
.font-medium { font-weight: 500; }
.text-muted { color: var(--color-text-muted, #9ca3af); font-size: 13px; }

/* Badges */
.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-family: monospace;
}
.badge-dept { 
    background: rgba(16, 185, 129, 0.1); 
    color: #10b981; 
}

/* Modal */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    backdrop-filter: blur(2px);
}

.knowledge-modal {
    background-color: var(--color-bg-card, #202020);
    padding: 24px;
    border-radius: 12px;
    width: 420px;
    border: 1px solid var(--color-border, #374151);
    color: var(--color-text-primary, white);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
}

.knowledge-modal h2 { margin-top: 0; font-size: 18px; margin-bottom: 20px; }

.form-group { margin-bottom: 16px; }

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary, #e5e7eb);
}

.form-group input {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #4b5563);
    background: var(--color-bg-tertiary, #2a2a2a);
    color: var(--color-text-primary, white);
    font-size: 14px;
}
.form-group input:focus {
    outline: none;
    border-color: var(--color-accent, #3b82f6);
}

.hint {
    font-size: 12px;
    color: var(--color-text-muted, #9ca3af);
    margin-top: 4px;
}

.error { color: #ef4444; font-size: 13px; margin-bottom: 16px; background: rgba(239, 68, 68, 0.1); padding: 8px; border-radius: 4px; }

.actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
}
</style>
