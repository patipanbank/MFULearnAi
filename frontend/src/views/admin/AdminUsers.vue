<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <h1>Users</h1>
        <p class="subtitle">Manage all user accounts and roles.</p>
      </div>
      <div><!-- Spacer --></div>
    </div>

    <!-- Filters -->
    <div class="filters">
       <button 
        v-for="role in ['all', 'superadmin', 'admin', 'teacher', 'student']" 
        :key="role"
        class="filter-btn"
        :class="{ active: filterRole === role }"
        @click="filterRole = role"
      >
        {{ role.charAt(0).toUpperCase() + role.slice(1) }}
      </button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Department</th>
            <th>Status</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
           <tr v-if="loading && filteredUsers.length === 0">
               <td colspan="5" class="empty-row">Loading...</td>
           </tr>
           <tr v-else-if="filteredUsers.length === 0">
               <td colspan="5" class="empty-row">No users found.</td>
           </tr>
           <tr v-for="user in filteredUsers" :key="user._id" class="clickable-row" @click="openEditModal(user)">
             <td class="font-medium">
                <div class="user-cell">
                    <div class="user-info">
                        <div class="name">{{ user.firstName }} {{ user.lastName }}</div>
                        <div class="email">{{ user.email || user.username }}</div>
                    </div>
                </div>
             </td>
             <td>
                <span class="badge" :class="getRoleBadge(user.role)">{{ user.role }}</span>
             </td>
             <td class="text-muted">{{ user.department || '-' }}</td>
             <td>
                <span class="status-indicator" :class="{ 'active': user.isActive, 'inactive': !user.isActive }">
                    {{ user.isActive ? 'Active' : 'Inactive' }}
                </span>
             </td>
             <td class="text-date">{{ formatDate(user.createdAt) }}</td>
           </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit User Modal -->
    <Teleport to="body">
       <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
          <div class="knowledge-modal">
             <h2>Edit User</h2>
             
             <div class="user-summary mb-4 p-3 bg-gray-800 rounded">
                 <div class="font-bold">{{ form.firstName }} {{ form.lastName }}</div>
                 <div class="text-xs text-gray-400">{{ form.username }}</div>
             </div>

             <div class="form-group">
                 <label>Role</label>
                 <select v-model="form.role">
                     <option value="student">Student</option>
                     <option value="teacher">Teacher</option>
                     <option value="admin">Admin</option>
                     <option value="superadmin">Superadmin</option>
                 </select>
             </div>

             <div class="form-group">
                 <label>Department</label>
                 <input v-model="form.department" type="text" placeholder="Department">
             </div>

             <div class="form-group checkbox-group">
                 <label>
                     <input type="checkbox" v-model="form.isActive">
                     Account Active
                 </label>
             </div>
             
             <div v-if="error" class="error">{{ error }}</div>

             <div class="actions">
                 <button class="btn-delete" @click="handleDelete(form._id)">Delete User</button>
                 <div class="spacer"></div>
                 <button class="btn-cancel" @click="closeModal">Cancel</button>
                 <button class="btn-primary" @click="handleSubmit" :disabled="submitting">
                     {{ submitting ? 'Saving...' : 'Save' }}
                 </button>
             </div>
          </div>
       </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../../utils/api';

const users = ref([]);
const loading = ref(false);
const filterRole = ref('all');
const showModal = ref(false);
const submitting = ref(false);
const error = ref(null);

const form = ref({
    _id: null,
    username: '',
    firstName: '',
    lastName: '',
    role: '',
    department: '',
    isActive: true
});

const filteredUsers = computed(() => {
    if (filterRole.value === 'all') return users.value;
    return users.value.filter(u => u.role === filterRole.value);
});

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getRoleBadge = (role) => {
    switch(role) {
        case 'superadmin': return 'badge-superadmin';
        case 'admin': return 'badge-admin';
        case 'teacher': return 'badge-teacher';
        default: return 'badge-student';
    }
};

const fetchUsers = async () => {
    loading.value = true;
    try {
        // Use generic users endpoint
        const response = await api.get('/users');
        users.value = response.data.users || [];
    } catch (err) {
        console.error('Failed to fetch users:', err);
    } finally {
        loading.value = false;
    }
};

const openEditModal = (user) => {
    form.value = { ...user };
    error.value = null;
    showModal.value = true;
};

const closeModal = () => {
    showModal.value = false;
};

const handleSubmit = async () => {
    submitting.value = true;
    error.value = null;

    try {
        await api.put(`/users/${form.value._id}`, {
            role: form.value.role,
            department: form.value.department,
            isActive: form.value.isActive
        });
        await fetchUsers();
        closeModal();
    } catch (err) {
        error.value = err.response?.data?.error || err.message || 'Operation failed';
    } finally {
        submitting.value = false;
    }
};

const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    
    try {
        await api.delete(`/users/${id}`);
        users.value = users.value.filter(u => u._id !== id);
        closeModal();
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete');
    }
};

onMounted(() => {
    fetchUsers();
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

/* Filters */
.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-btn {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid var(--color-border, #374151);
  background: transparent;
  color: var(--color-text-secondary, #9ca3af);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--color-bg-tertiary, #2a2a2a);
}

.filter-btn.active {
  background: var(--color-accent, #3b82f6);
  color: white;
  border-color: var(--color-accent, #3b82f6);
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
  flex: 1;
  display: flex;
  flex-direction: column;
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
.text-muted { color: var(--color-text-muted, #9ca3af); font-size: 13px; }
.text-date { color: var(--color-text-secondary, #d1d5db); font-size: 13px; }

.user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
}
.user-info .name { font-weight: 500; color: var(--color-text-primary, white); }
.user-info .email { font-size: 12px; color: var(--color-text-muted, #9ca3af); }

/* Badges */
.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}
.badge-superadmin { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
.badge-admin { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.badge-teacher { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.badge-student { background: rgba(107, 114, 128, 0.1); color: #9ca3af; }

.status-indicator {
    font-size: 12px;
    font-weight: 500;
}
.status-indicator.active { color: #10b981; }
.status-indicator.inactive { color: #ef4444; }

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
    width: 480px;
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

.checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.form-group input[type="text"], 
.form-group select {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #4b5563);
    background: var(--color-bg-tertiary, #2a2a2a);
    color: var(--color-text-primary, white);
    font-size: 14px;
}
.form-group input:focus, .form-group select:focus {
    outline: none;
    border-color: var(--color-accent, #3b82f6);
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
