import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Document {
  id: string
  filename: string
  size: number
  uploadedAt: Date
  type: 'file' | 'url'
}

export interface Collection {
  id: string
  name: string
  description?: string
  documents: Document[]
  createdAt: Date
}

export const useKnowledgeBaseStore = defineStore('knowledge-base', () => {
  const collections = ref<Collection[]>([
    {
      id: '1',
      name: 'General Policy',
      description: 'University general policies and guidelines',
      createdAt: new Date(),
      documents: [
        { id: '1', filename: 'student_handbook_2024.pdf', size: 1024 * 1024 * 5, uploadedAt: new Date(), type: 'file' },
        { id: '2', filename: 'https://reg.mfu.ac.th', size: 0, uploadedAt: new Date(), type: 'url' }
      ]
    },
    {
      id: '2',
      name: 'Course Syllabus',
      description: 'Syllabus for Computer Science',
      createdAt: new Date(),
      documents: []
    }
  ])
  
  const selectedCollectionId = ref<string | null>(null)
  const isUploading = ref(false)

  function selectCollection(id: string) {
    selectedCollectionId.value = id
  }

  function createCollection(name: string, description: string) {
    collections.value.push({
      id: Date.now().toString(),
      name,
      description,
      documents: [],
      createdAt: new Date()
    })
  }

  function deleteCollection(id: string) {
    collections.value = collections.value.filter(c => c.id !== id)
    if (selectedCollectionId.value === id) {
      selectedCollectionId.value = null
    }
  }

  function addDocument(collectionId: string, doc: Document) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (collection) {
      collection.documents.push(doc)
    }
  }

  function deleteDocument(collectionId: string, docId: string) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (collection) {
      collection.documents = collection.documents.filter(d => d.id !== docId)
    }
  }

  return {
    collections,
    selectedCollectionId,
    isUploading,
    selectCollection,
    createCollection,
    deleteCollection,
    addDocument,
    deleteDocument
  }
})
