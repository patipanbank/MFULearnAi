import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from './auth'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const useKnowledgeStore = defineStore('knowledge', () => {
    const knowledge = ref([])
    const collections = ref([])
    const currentCollection = ref(null)
    const loading = ref(false)
    const error = ref(null)

    // Helper to get auth headers
    const getHeaders = () => {
        const authStore = useAuthStore()
        return {
            headers: {
                Authorization: `Bearer ${authStore.token}`
            }
        }
    }

    // --- Knowledge Actions ---

    async function fetchKnowledge(type = null) {
        loading.value = true
        error.value = null
        try {
            const params = type ? { type } : {}
            const res = await axios.get(`${API_URL}/knowledge`, {
                params,
                ...getHeaders()
            })
            knowledge.value = res.data.knowledge
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            console.error('Fetch knowledge failed:', e)
        } finally {
            loading.value = false
        }
    }

    async function uploadKnowledge(file, type) {
        loading.value = true
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', type)

            await axios.post(`${API_URL}/knowledge`, formData, {
                headers: {
                    ...getHeaders().headers,
                    'Content-Type': 'multipart/form-data'
                }
            })
            await fetchKnowledge() // Refresh list
            return true
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    async function deleteKnowledge(id) {
        loading.value = true
        try {
            await axios.delete(`${API_URL}/knowledge/${id}`, getHeaders())
            knowledge.value = knowledge.value.filter(k => k._id !== id)
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    async function requestPublish(id, targetType) {
        loading.value = true
        try {
            await axios.post(
                `${API_URL}/knowledge/${id}/request-publish`,
                { targetType },
                getHeaders()
            )
            await fetchKnowledge()
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    async function approvePublish(id, action) {
        loading.value = true
        try {
            await axios.post(
                `${API_URL}/knowledge/${id}/approve-publish`,
                { action },
                getHeaders()
            )
            await fetchKnowledge()
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    // --- Collection Actions ---

    async function fetchCollections() {
        loading.value = true
        try {
            const res = await axios.get(`${API_URL}/knowledge/collections`, getHeaders())
            collections.value = res.data.collections
        } catch (e) {
            error.value = e.response?.data?.error || e.message
        } finally {
            loading.value = false
        }
    }

    async function createCollection(payload) {
        loading.value = true
        try {
            await axios.post(`${API_URL}/knowledge/collections`, payload, getHeaders())
            await fetchCollections()
            return true
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    async function fetchCollectionDetails(id) {
        loading.value = true
        currentCollection.value = null
        try {
            const res = await axios.get(`${API_URL}/knowledge/collections/${id}`, getHeaders())
            currentCollection.value = res.data.collection
        } catch (e) {
            error.value = e.response?.data?.error || e.message
        } finally {
            loading.value = false
        }
    }

    async function mapKnowledge(collectionId, knowledgeId, action) {
        // action: 'add' or 'remove'
        try {
            await axios.post(
                `${API_URL}/knowledge/collections/${collectionId}/map`,
                { knowledgeId, action },
                getHeaders()
            )
            // Refresh details if currently viewing this collection
            if (currentCollection.value?._id === collectionId) {
                await fetchCollectionDetails(collectionId)
            }
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        }
    }

    return {
        knowledge,
        collections,
        currentCollection,
        loading,
        error,
        fetchKnowledge,
        uploadKnowledge,
        deleteKnowledge,
        requestPublish,
        approvePublish,
        fetchCollections,
        createCollection,
        fetchCollectionDetails,
        mapKnowledge
    }
})
