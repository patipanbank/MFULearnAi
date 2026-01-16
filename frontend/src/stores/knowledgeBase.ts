import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export interface Collection {
  id: string // mapping from _id
  name: string
  description: string
  documentCount: number
  permission: 'public' | 'private'
  updatedAt: string
}

export interface Document {
  id: string
  title: string
  type: 'file' | 'url'
  size?: string
  uploadedAt: string
  status: 'indexed' | 'processing' | 'error'
  url?: string
}

export const useKnowledgeBaseStore = defineStore('knowledgeBase', () => {
  const collections = ref<Collection[]>([])
  const documents = ref<Document[]>([])
  const selectedCollectionId = ref<string | null>(null)
  const isLoading = ref(false)

  // Fetch Collections
  async function fetchCollections() {
    isLoading.value = true
    try {
      const response = await axios.get('/api/training/collections')
      collections.value = response.data.map((c: any) => ({
        id: c._id || c.name, // Use name as ID if _id missing, or map appropriately
        name: c.name,
        description: c.description || '',
        documentCount: c.documentCount || 0,
        permission: c.permission || 'private',
        updatedAt: c.updatedAt
      }))
    } catch (error) {
      console.error('Error fetching collections', error)
      collections.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Create Collection
  async function createCollection(name: string, description: string, isPrivate: boolean) {
    isLoading.value = true
    try {
      await axios.post('/api/training/collections', {
        name,
        description,
        permission: isPrivate ? 'private' : 'public'
      })
      await fetchCollections()
      // Select the new collection
      const newCol = collections.value.find(c => c.name === name)
      if (newCol) selectedCollectionId.value = newCol.id
    } catch (error) {
      console.error('Error creating collection', error)
      throw error // Re-throw to handle in UI
    } finally {
      isLoading.value = false
    }
  }

  // Delete Collection
  async function deleteCollection(id: string) {
    // We need the name to delete, find it first
    const col = collections.value.find(c => c.id === id)
    if (!col) return

    if (!confirm(`Are you sure you want to delete collection "${col.name}"?`)) return

    try {
      await axios.delete(`/api/training/collections/${col.name}`)
      await fetchCollections()
      if (selectedCollectionId.value === id) {
        selectedCollectionId.value = null
        documents.value = []
      }
    } catch (error) {
      console.error('Error deleting collection', error)
    }
  }

  // Select Collection & Fetch Documents
  async function selectCollection(id: string) {
    selectedCollectionId.value = id
    const col = collections.value.find(c => c.id === id)
    if (!col) return

    // Fetch documents for this collection
    await fetchDocuments(col.name)
  }

  async function fetchDocuments(collectionName: string) {
    isLoading.value = true
    try {
      const response = await axios.get('/api/training/documents', {
        params: { collection: collectionName }
      })
      
      documents.value = response.data.docs.map((d: any) => ({
        id: d._id,
        title: d.filename || d.url,
        type: d.url ? 'url' : 'file',
        size: d.size ? formatSize(d.size) : '-',
        uploadedAt: d.createdAt,
        status: 'indexed', // Mock status as backend might not return it directly
        url: d.url
      }))
    } catch (error) {
      console.error('Error fetching documents', error)
      documents.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Upload Files
  async function uploadFiles(files: File[]) {
    const col = collections.value.find(c => c.id === selectedCollectionId.value)
    if (!col) return

    isLoading.value = true
    try {
      const formData = new FormData()
      formData.append('collectionName', col.name)
      files.forEach(file => {
        formData.append('files', file)
      })

      await axios.post('/api/training/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      await fetchDocuments(col.name)
    } catch (error) {
      console.error('Error uploading files', error)
      alert('Failed to upload files')
    } finally {
      isLoading.value = false
    }
  }

  // Add URL
  async function addUrl(url: string) {
    const col = collections.value.find(c => c.id === selectedCollectionId.value)
    if (!col) return

    isLoading.value = true
    try {
      await axios.post('/api/training/urls', {
        collectionName: col.name,
        url
      })
      await fetchDocuments(col.name)
    } catch (error) {
      console.error('Error adding URL', error)
      alert('Failed to add URL')
    } finally {
      isLoading.value = false
    }
  }

  // Delete Document
  async function deleteDocument(docId: string) {
    if (!confirm('Delete this document?')) return
    
    try {
      await axios.delete(`/api/training/documents/${docId}`)
      
      // Refresh list
      const col = collections.value.find(c => c.id === selectedCollectionId.value)
      if (col) await fetchDocuments(col.name)
        
    } catch (error) {
      console.error('Error deleting document', error)
    }
  }
  
  function formatSize(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return {
    collections,
    documents,
    selectedCollectionId,
    isLoading,
    fetchCollections,
    createCollection,
    deleteCollection,
    selectCollection,
    uploadFiles,
    addUrl,
    deleteDocument
  }
})
