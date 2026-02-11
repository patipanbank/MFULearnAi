<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <h1>Departments</h1>
        <p class="subtitle">Manage university departments. Auto-created from SSO logins.</p>
      </div>
      <button v-if="isSuperAdmin" class="btn-primary" @click="openCreateModal">
        <span class="icon">+</span> Create Department
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
          <div class="modal-card">
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
            await api.post('/departments', { name: form.value.name, code: null });
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
/* Page-specific styles only — shared styles in main.css */

.text-date {
    color: var(--color-text-secondary);
    font-size: 13px;
}

.btn-icon.delete {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
}
.btn-icon.delete:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}

.actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
}

.error {
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 16px;
    background: rgba(239, 68, 68, 0.1);
    padding: 8px;
    border-radius: 4px;
}
</style>
