<template>
  <div class="h-full flex flex-col bg-gray-900 text-white p-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold mb-1">Admin Management</h1>
        <p class="text-gray-400 text-sm">Manage local administrator accounts.</p>
      </div>
      <button 
        @click="showCreateModal = true"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"
      >
        <i class="fas fa-plus"></i> New Admin
      </button>
    </div>

    <!-- Admin List -->
    <div class="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead class="bg-gray-800/50 border-b border-gray-700">
                    <tr>
                        <th class="p-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Username</th>
                        <th class="p-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Name</th>
                        <th class="p-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Department</th>
                        <th class="p-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Role</th>
                        <th class="p-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Last Login</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-700">
                    <tr v-if="loading && admins.length === 0">
                        <td colspan="5" class="p-4 text-center text-gray-500 py-8">Loading admins...</td>
                    </tr>
                    <tr v-for="admin in admins" :key="admin._id" class="hover:bg-gray-700/50 transition-colors">
                        <td class="p-4 font-medium text-gray-200">{{ admin.username }}</td>
                        <td class="p-4 text-gray-400">{{ admin.firstName }} {{ admin.lastName }}</td>
                        <td class="p-4 text-gray-400">
                            <span v-if="admin.department" class="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">{{ admin.department }}</span>
                            <span v-else class="text-gray-600">-</span>
                        </td>
                        <td class="p-4">
                            <span 
                                class="px-2 py-0.5 text-xs rounded-full border"
                                :class="admin.role === 'superadmin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'"
                            >
                                {{ admin.role }}
                            </span>
                        </td>
                         <td class="p-4 text-gray-500 text-sm">{{ formatDate(admin.lastLogin) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Create Admin Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div class="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden relative">
            <div class="p-6">
                <h2 class="text-xl font-bold mb-4">Create Admin Account</h2>
                
                <form @submit.prevent="createAdmin" class="space-y-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-400 mb-1">Username</label>
                        <input v-model="form.username" type="text" required class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" placeholder="e.g. admin_it">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                             <label class="block text-xs font-medium text-gray-400 mb-1">First Name</label>
                             <input v-model="form.firstName" type="text" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none" placeholder="John">
                        </div>
                        <div>
                             <label class="block text-xs font-medium text-gray-400 mb-1">Last Name</label>
                             <input v-model="form.lastName" type="text" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none" placeholder="Doe">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-gray-400 mb-1">Password</label>
                        <input v-model="form.password" type="password" required class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none" placeholder="••••••••">
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-gray-400 mb-1">Department</label>
                        <!-- In a real app, this would be a select from fetched departments -->
                        <div class="relative">
                            <input v-model="form.department" type="text" list="dept-list" required class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none" placeholder="Select or type department code">
                            <datalist id="dept-list">
                                <option v-for="d in cachedDepartments" :key="d.code" :value="d.code">{{ d.name }}</option>
                            </datalist>
                        </div>
                         <p class="text-[10px] text-gray-500 mt-1">If department doesn't exist, it will be auto-created.</p>
                    </div>

                    <div v-if="error" class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {{ error }}
                    </div>
                    
                    <div class="flex gap-3 mt-6">
                        <button type="button" @click="showCreateModal = false" class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors">Cancel</button>
                        <button type="submit" :disabled="submitting" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
                            {{ submitting ? 'Creating...' : 'Create Account' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const admins = ref([]);
const cachedDepartments = ref([]);
const loading = ref(false);
const showCreateModal = ref(false);
const submitting = ref(false);
const error = ref(null);

const form = ref({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    department: ''
});

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
};

const fetchAdmins = async () => {
    loading.value = true;
    try {
        const response = await axios.get('/api/users/admins');
        admins.value = response.data.admins || [];
    } catch (error) {
        console.error('Failed to fetch admins:', error);
    } finally {
        loading.value = false;
    }
};

const fetchDepartments = async () => {
    try {
        const response = await axios.get('/api/departments');
        cachedDepartments.value = response.data.departments || [];
    } catch (e) { /* ignore */ }
};

const createAdmin = async () => {
    submitting.value = true;
    error.value = null;
    try {
        await axios.post('/api/users/create-admin', form.value);
        showCreateModal.value = false;
        form.value = { username: '', password: '', firstName: '', lastName: '', department: '' }; // Reset
        fetchAdmins(); // Refresh
        fetchDepartments(); // Refresh departments in case new one created
        // Success toast could go here
    } catch (err) {
        error.value = err.response?.data?.error || 'Failed to create admin';
    } finally {
        submitting.value = false;
    }
};

onMounted(() => {
    fetchAdmins();
    fetchDepartments();
});
</script>
