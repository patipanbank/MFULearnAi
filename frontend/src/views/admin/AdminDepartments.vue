<template>
  <div class="h-full flex flex-col bg-gray-900 text-white p-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold mb-1">Departments</h1>
        <p class="text-gray-400 text-sm">Departments are automatically created from SSO login data.</p>
      </div>
      <button 
        @click="fetchDepartments" 
        class="p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
        title="Refresh"
      >
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
      </button>
    </div>

    <!-- Table -->
    <div class="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead class="bg-gray-800/50 border-b border-gray-700">
                    <tr>
                        <th class="p-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Code</th>
                        <th class="p-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Name</th>
                        <th class="p-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Created At</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-700">
                    <tr v-if="loading && departments.length === 0">
                        <td colspan="3" class="p-4 text-center text-gray-500 py-8">Loading departments...</td>
                    </tr>
                    <tr v-else-if="departments.length === 0">
                         <td colspan="3" class="p-4 text-center text-gray-500 py-8">No departments found. Login with SSO to auto-create.</td>
                    </tr>
                    <tr v-for="dept in departments" :key="dept._id" class="hover:bg-gray-700/50 transition-colors">
                        <td class="p-4 font-mono text-blue-400 text-sm">{{ dept.code }}</td>
                        <td class="p-4 text-gray-200 font-medium">{{ dept.name }}</td>
                        <td class="p-4 text-gray-500 text-sm">{{ formatDate(dept.createdAt) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const departments = ref([]);
const loading = ref(false);

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
};

const fetchDepartments = async () => {
    loading.value = true;
    try {
        const response = await axios.get('/api/departments');
        departments.value = response.data.departments || [];
    } catch (error) {
        console.error('Failed to fetch departments:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchDepartments();
});
</script>
