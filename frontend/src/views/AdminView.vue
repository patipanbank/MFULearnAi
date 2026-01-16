<script setup lang="ts">
import { ref } from 'vue'
import { 
  Users, 
  Terminal, 
  Search, 
  MoreVertical, 
  Shield, 
  Save
} from 'lucide-vue-next'

const activeTab = ref<'users' | 'prompt'>('users')

// Mock Users Data
const users = ref([
  { id: '1', name: 'John Doe', email: 'john.doe@mfu.ac.th', role: 'Student', status: 'Active' },
  { id: '2', name: 'Jane Smith', email: 'jane.smith@mfu.ac.th', role: 'Staff', status: 'Active' },
  { id: '3', name: 'Admin User', email: 'admin@mfu.ac.th', role: 'SuperAdmin', status: 'Active' },
])

const systemPrompt = ref(`You are MFULearnAi, a helpful assistant for Mae Fah Luang University students and staff.
Your goal is to provide accurate information based on the university's knowledge base.
If you are unsure, please advise the user to contact the relevant department directly.`)

const savePrompt = () => {
  // Save logic here
  alert('System prompt saved!')
}



</script>

<template>
  <div class="h-full flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p class="text-gray-500">Manage users and system configuration.</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 border-b border-gray-200">
      <button 
        @click="activeTab = 'users'"
        class="px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2"
        :class="activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
      >
        <Users class="w-4 h-4" />
        User Management
      </button>
      <button 
        @click="activeTab = 'prompt'"
        class="px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2"
        :class="activeTab === 'prompt' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
      >
        <Terminal class="w-4 h-4" />
        System Prompt
      </button>
    </div>

    <!-- User Management Tab -->
    <div v-if="activeTab === 'users'" class="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      <!-- Toolbar -->
      <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div class="relative w-64">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search users..." 
            class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
        </div>
        <div class="flex gap-2">
           <button class="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add User</button>
        </div>
      </div>

      <!-- Users Table -->
      <div class="flex-1 overflow-auto">
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-6 py-3 font-medium">User</th>
              <th class="px-6 py-3 font-medium">Role</th>
              <th class="px-6 py-3 font-medium">Status</th>
              <th class="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                    {{ user.name.charAt(0) }}
                  </div>
                  <div>
                    <div class="font-medium text-gray-900">{{ user.name }}</div>
                    <div class="text-xs text-gray-500">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span 
                  class="px-2.5 py-0.5 rounded-full text-xs font-medium border"
                  :class="{
                    'bg-blue-50 text-blue-700 border-blue-200': user.role === 'Student',
                    'bg-purple-50 text-purple-700 border-purple-200': user.role === 'Staff',
                    'bg-red-50 text-red-700 border-red-200': user.role === 'SuperAdmin' || user.role === 'Admin'
                  }"
                >
                  {{ user.role }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span class="flex items-center gap-1.5 text-green-600">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                  {{ user.status }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <button class="text-gray-400 hover:text-gray-600">
                  <MoreVertical class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- System Prompt Tab -->
    <div v-else class="max-w-4xl w-full mx-auto">
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="font-semibold text-gray-900 text-lg">System Prompt</h3>
            <p class="text-sm text-gray-500">Define the core personality and instructions for the AI.</p>
          </div>
          <button 
            @click="savePrompt"
            class="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Save class="w-4 h-4" />
            Save Changes
          </button>
        </div>

        <div class="relative">
          <textarea 
            v-model="systemPrompt"
            class="w-full h-96 p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            spellcheck="false"
          ></textarea>
          <div class="absolute bottom-4 right-4 text-xs text-gray-400">
            {{ systemPrompt.length }} characters
          </div>
        </div>

        <div class="mt-4 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm flex gap-3 items-start">
           <Shield class="w-5 h-5 shrink-0 mt-0.5" />
           <div>
             <strong>Tip:</strong> Be specific about constraints. For example, explicitly state what the AI should decline to answer.
           </div>
        </div>
      </div>
    </div>
  </div>
</template>
