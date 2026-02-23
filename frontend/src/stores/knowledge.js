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
    let pollInterval = null

    // Helper to get auth headers
    const getHeaders = () => {
        const authStore = useAuthStore()
        return {
            headers: {
                Authorization: `Bearer ${authStore.token}`
            }
        }
    }


    const startPolling = () => {
        if (pollInterval) return
        pollInterval = setInterval(async () => {
            const hasPending = knowledge.value.some(k =>
                k.processingStatus === 'pending' || k.processingStatus === 'processing'
            )
            if (!hasPending) {
                stopPolling()
                return
            }
            // Silent refresh
            try {
                const res = await axios.get(`${API_URL}/knowledge`, getHeaders())
                knowledge.value = res.data.knowledge
            } catch (e) { console.error('Poll failed', e) }
        }, 5000)
    }

    const stopPolling = () => {
        if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
        }
    }

    // --- Knowledge Actions ---

    async function fetchKnowledge(params = {}) {
        loading.value = true
        error.value = null
        try {
            // Backward compatibility for string argument
            const queryParams = typeof params === 'string' ? { type: params } : { ...params }

            // Clean up 'all' type
            if (queryParams.type === 'all') delete queryParams.type

            const res = await axios.get(`${API_URL}/knowledge`, {
                params: queryParams,
                ...getHeaders()
            })

            // If fetching specific requests (like pending), we might return them or update main list
            // For now, update main list as Admin UI will likely use a separate store call or just filter this list.
            knowledge.value = res.data.knowledge

            // Start polling if needed
            const hasPending = knowledge.value.some(k =>
                k.processingStatus === 'pending' || k.processingStatus === 'processing'
            )
            if (hasPending) startPolling()

            return res.data.knowledge
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            console.error('Fetch knowledge failed:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function fetchPendingRequests() {
        // Separate API call — does NOT overwrite the main knowledge list
        try {
            const res = await axios.get(`${API_URL}/knowledge`, {
                params: { requestStatus: 'pending' },
                ...getHeaders()
            })
            return res.data.knowledge || []
        } catch (e) {
            console.error('Fetch pending requests failed:', e)
            throw e
        }
    }

    async function uploadKnowledge(file, type, folder, expiresAt, onProgress) {
        loading.value = true
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', type)
            if (folder) formData.append('folder', folder)
            if (expiresAt) formData.append('expiresAt', expiresAt)

            await axios.post(`${API_URL}/knowledge`, formData, {
                headers: {
                    ...getHeaders().headers,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        onProgress(percent)
                    }
                }
            })
            await fetchKnowledge() // Refresh list
            startPolling() // Start polling for the new file
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

    async function retryKnowledge(id) {
        loading.value = true
        try {
            await axios.post(`${API_URL}/knowledge/${id}/retry`, {}, getHeaders())
            await fetchKnowledge() // Refresh list
            startPolling() // Start polling for the retried job
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

    async function extractText(file) {
        loading.value = true
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await axios.post(`${API_URL}/knowledge/extract`, formData, {
                headers: {
                    ...getHeaders().headers,
                    'Content-Type': 'multipart/form-data'
                }
            })
            return res.data.text
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    async function updateKnowledge(id, updates) {
        try {
            const res = await axios.patch(`${API_URL}/knowledge/${id}`, updates, getHeaders())
            // Update local state reactively
            const idx = knowledge.value.findIndex(k => k._id === id)
            if (idx !== -1 && res.data.knowledge) {
                knowledge.value[idx] = { ...knowledge.value[idx], ...res.data.knowledge }
            }
            return res.data.knowledge
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
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

    async function updateCollection(id, payload) {
        loading.value = true
        try {
            await axios.put(`${API_URL}/knowledge/collections/${id}`, payload, getHeaders())
            await fetchCollections()
            return true
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    async function deleteCollection(id) {
        loading.value = true
        try {
            await axios.delete(`${API_URL}/knowledge/collections/${id}`, getHeaders())
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

    // --- URL Scraper ---
    async function createFromUrl(url, type, folder, expiresAt) {
        try {
            const payload = { url, type }
            if (folder) payload.folder = folder
            if (expiresAt) payload.expiresAt = expiresAt

            const res = await axios.post(`${API_URL}/knowledge/url`, payload, getHeaders())
            await fetchKnowledge() // Refresh list
            startPolling() // Start polling for background job
            return res.data
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        }
    }

    // --- Raw Text Importer ---
    async function createFromText(title, textContent, type, folder, expiresAt) {
        try {
            const payload = { title, text: textContent, type }
            if (folder) payload.folder = folder
            if (expiresAt) payload.expiresAt = expiresAt

            const res = await axios.post(`${API_URL}/knowledge/text`, payload, getHeaders())
            await fetchKnowledge() // Refresh list
            startPolling() // Start polling for background job
            return res.data
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        }
    }

    // --- Analytics ---
    const stats = ref(null)
    const statsLoading = ref(false)

    async function fetchStats() {
        statsLoading.value = true
        try {
            const res = await axios.get(`${API_URL}/knowledge/stats`, getHeaders())
            stats.value = res.data
            return res.data
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            statsLoading.value = false
        }
    }

    async function fetchDocumentAnalytics(id) {
        try {
            const res = await axios.get(`${API_URL}/knowledge/${id}/analytics`, getHeaders())
            return res.data
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
        stats,
        statsLoading,
        fetchKnowledge,
        uploadKnowledge,
        deleteKnowledge,
        retryKnowledge,
        requestPublish,
        approvePublish,
        fetchCollections,
        createCollection,
        updateCollection,
        deleteCollection,
        fetchCollectionDetails,
        mapKnowledge,
        fetchPendingRequests,
        extractText,
        updateKnowledge,
        createFromUrl,
        createFromText,
        fetchStats,
        fetchDocumentAnalytics
    }
})
