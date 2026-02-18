<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <h1>Departments</h1>
        <p class="subtitle">Manage university departments. Auto-created from SSO logins.</p>
      </div>
      <button v-if="isSuperAdmin" class="btn-primary" @click="openCreateModal">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Create Department
      </button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Created At</th>
            <th v-if="isSuperAdmin">Actions</th>
          </tr>
        </thead>
        <tbody>
           <tr v-if="loading && departments.length === 0">
               <td :colspan="isSuperAdmin ? 3 : 2" class="empty-row">Loading...</td>
           </tr>
           <tr v-else-if="departments.length === 0">
               <td :colspan="isSuperAdmin ? 3 : 2" class="empty-row">No departments found.</td>
           </tr>
           <tr v-for="dept in departments" :key="dept._id" class="clickable-row" @click="openEditModal(dept)">
             <td class="font-medium">{{ dept.name }}</td>
             <td class="text-date">{{ formatDate(dept.createdAt) }}</td>
             <td v-if="isSuperAdmin" class="actions-cell" @click.stop>
               <button class="btn-icon delete" @click="handleDelete(dept._id)" title="Delete">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
                 <input v-model="form.name" type="text" placeholder="e.g. School of IT" ref="nameInput" :disabled="!isSuperAdmin">
             </div>

             <!-- Code field hidden as per request, handled automatically -->
             
             <div v-if="error" class="error">{{ error }}</div>

             <div class="actions">
                 <button v-if="isEditing && isSuperAdmin" class="btn-delete" @click="handleDelete(form._id)">Delete</button>
                 <div class="spacer"></div>
                 <button class="btn-cancel" @click="closeModal">{{ isSuperAdmin ? 'Cancel' : 'Close' }}</button>
                 <button v-if="isSuperAdmin" class="btn-primary" @click="handleSubmit" :disabled="submitting || !form.name">
                     {{ submitting ? 'Saving...' : 'Save' }}
                 </button>
             </div>
          </div>
       </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import api from '../../utils/api';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const isSuperAdmin = computed(() => authStore.role === 'superadmin');

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
    // Use a clearer format
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fetchDepartments = async () => {
    loading.value = true;
    try {
        const response = await api.get('/auth/departments', { baseURL: '/' });
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
            await api.put(`/auth/departments/${form.value._id}`, { name: form.value.name }, { baseURL: '/' });
        } else {
            await api.post('/auth/departments', { name: form.value.name, code: null }, { baseURL: '/' });
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
        await api.delete(`/auth/departments/${id}`, { baseURL: '/' });
        departments.value = departments.value.filter(d => d._id !== id);
        closeModal(); // Close modal after delete
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

.btn-delete {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
}
.btn-delete:hover { background: rgba(239, 68, 68, 0.2); }

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

.font-medium { font-weight: 500; }
.text-date { 
    color: var(--color-text-secondary, #d1d5db); /* Brighter than muted for better visibility */
    font-size: 13px; 
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
    align-items: center;
    gap: 12px;
    margin-top: 24px;
}

.spacer { flex: 1; }
</style>
