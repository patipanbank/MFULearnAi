<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKnowledgeBaseStore } from '../stores/knowledgeBase'
import { 
  Folder, 
  FileText, 
  Link as LinkIcon, 
  Upload, 
  Plus, 
  Trash2, 
  Globe
} from 'lucide-vue-next'

const kbStore = useKnowledgeBaseStore()
const showCreateModal = ref(false)
const newCollectionName = ref('')
const newCollectionDesc = ref('')
const urlInput = ref('')
const isPrivate = ref(true)

const handleCreateCollection = () => {
  if (!newCollectionName.value) return
  kbStore.createCollection(newCollectionName.value, newCollectionDesc.value, isPrivate.value)
  showCreateModal.value = false
  newCollectionName.value = ''
  newCollectionDesc.value = ''
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length || !kbStore.selectedCollectionId) return
  
  kbStore.uploadFiles(Array.from(target.files))
  
  target.value = '' // Reset input
}

const handleAddUrl = () => {
  if (!urlInput.value || !kbStore.selectedCollectionId) return
  
  kbStore.addUrl(urlInput.value)
  
  urlInput.value = ''
}

import { onMounted } from 'vue'
onMounted(() => {
  kbStore.fetchCollections()
})

const selectedCollection = computed(() => 
  kbStore.collections.find(c => c.id === kbStore.selectedCollectionId)
)
</script>

<template>
  <div class="h-full flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p class="text-gray-500">Manage training data for the AI model.</p>
      </div>
      <button 
        @click="showCreateModal = true"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
      >
        <Plus class="w-5 h-5" />
        New Collection
      </button>
    </div>

    <!-- Collections Grid -->
    <div v-if="!selectedCollection" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div 
        v-for="collection in kbStore.collections" 
        :key="collection.id"
        @click="kbStore.selectCollection(collection.id)"
        class="group bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
      >
        <div class="flex justify-between items-start mb-4">
          <div class="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
            <Folder class="w-6 h-6" />
          </div>
          <button 
            @click.stop="kbStore.deleteCollection(collection.id)"
            class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 class="w-5 h-5" />
          </button>
        </div>
        <h3 class="font-semibold text-gray-900 mb-1">{{ collection.name }}</h3>
        <p class="text-sm text-gray-500 line-clamp-2 mb-4 h-10">{{ collection.description || 'No description' }}</p>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <FileText class="w-4 h-4" />
          <span>{{ collection.documentCount }} documents</span>
        </div>
      </div>
    </div>

    <!-- Selected Collection Detail -->
    <div v-else class="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
        <div class="flex items-center gap-4">
          <button 
            @click="kbStore.selectCollection('')"
            class="text-gray-500 hover:text-gray-700"
          >
            <span class="text-sm">← Back</span>
          </button>
          <div class="h-6 w-px bg-gray-300"></div>
          <div>
            <h2 class="font-semibold text-gray-900">{{ selectedCollection.name }}</h2>
            <p class="text-xs text-gray-500">Last updated: {{ new Date(selectedCollection.updatedAt).toLocaleDateString() }}</p>
          </div>
        </div>
        <div class="flex gap-2">
           <!-- Actions -->
        </div>
      </div>

      <!-- Upload/Add Area -->
      <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 border-b border-gray-200">
        <!-- File Upload -->
        <div class="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors relative">
          <input 
            type="file" 
            multiple 
            @change="handleFileUpload"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
          <Upload class="w-8 h-8 text-blue-500 mb-2" />
          <p class="text-sm font-medium text-gray-900">Drop files here or click to upload</p>
          <p class="text-xs text-gray-500 mt-1">PDF, TXT, DOCX supported</p>
        </div>

        <!-- URL Input -->
        <div class="flex flex-col gap-3">
          <div class="font-medium text-sm text-gray-700">Add content from URL</div>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <Globe class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                v-model="urlInput"
                type="url" 
                placeholder="https://example.com"
                class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
            </div>
            <button 
              @click="handleAddUrl"
              class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              :disabled="!urlInput"
            >
              Add
            </button>
          </div>
          <p class="text-xs text-gray-500">The content will be scraped and added to the knowledge base.</p>
        </div>
      </div>

      <!-- Documents List -->
      <div class="flex-1 overflow-y-auto p-2">
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-4 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium w-32">Type</th>
              <th class="px-4 py-3 font-medium w-32">Size</th>
              <th class="px-4 py-3 font-medium w-40">Date</th>
              <th class="px-4 py-3 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="kbStore.documents.length === 0">
               <td colspan="5" class="py-8 text-center text-gray-500">No documents found</td>
            </tr>
            <tr 
              v-for="doc in kbStore.documents" 
              :key="doc.id"
              class="border-b border-gray-50 hover:bg-gray-50 group"
            >
              <td class="px-4 py-3 font-medium text-gray-900 flex items-center gap-3">
                <FileText v-if="doc.type === 'file'" class="w-4 h-4 text-blue-500" />
                <LinkIcon v-else class="w-4 h-4 text-purple-500" />
                <span class="truncate max-w-md">{{ doc.title }}</span>
              </td>
              <td class="px-4 py-3 text-gray-500 capitalize">{{ doc.type }}</td>
              <td class="px-4 py-3 text-gray-500">{{ doc.type === 'file' ? doc.size : '-' }}</td>
              <td class="px-4 py-3 text-gray-500">{{ new Date(doc.uploadedAt).toLocaleDateString() }}</td>
              <td class="px-4 py-3 text-right">
                <button 
                  @click="kbStore.deleteDocument(doc.id)"
                  class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Collection Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 class="text-xl font-bold mb-4">Create New Collection</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input 
              v-model="newCollectionName"
              type="text" 
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. University Rules"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
              v-model="newCollectionDesc"
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows="3"
              placeholder="What does this collection contain?"
            ></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button 
            @click="showCreateModal = false"
            class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button 
            @click="handleCreateCollection"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            :disabled="!newCollectionName"
          >
            Create Collection
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
