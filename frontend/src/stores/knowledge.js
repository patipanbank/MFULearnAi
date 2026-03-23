import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../utils/api'

export const useKnowledgeStore = defineStore('knowledge', () => {
    const knowledge = ref([])
    const collections = ref([])
    const currentCollection = ref(null)
    const loading = ref(false)
    const error = ref(null)
    let pollInterval = null


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
                const res = await api.get('/knowledge')
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

            const res = await api.get('/knowledge', {
                params: queryParams,
            })

            // Handle both paginated and non-paginated response formats
            knowledge.value = res.data.knowledge

            // Start polling if needed
            const hasPending = knowledge.value.some(k =>
                k.processingStatus === 'pending' || k.processingStatus === 'processing'
            )
            if (hasPending) startPolling()

            return {
                items: res.data.knowledge,
                pagination: res.data.pagination || null
            }
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
            const res = await api.get('/knowledge', {
                params: { requestStatus: 'pending' },
            })
            return res.data.knowledge || []
        } catch (e) {
            console.error('Fetch pending requests failed:', e)
            throw e
        }
    }

    async function uploadKnowledge(file, type, folder, expiresAt, onProgress, options = {}) {
        loading.value = true
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', type)
            if (folder) formData.append('folder', folder)
            if (expiresAt) formData.append('expiresAt', expiresAt)

            await api.post('/knowledge', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        onProgress(percent)
                    }
                }
            })
            if (!options.skipRefresh) {
                await fetchKnowledge() // Refresh list
                startPolling() // Start polling for the new file
            }
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
            await api.delete(`/knowledge/${id}`)
            knowledge.value = knowledge.value.filter(k => k._id !== id)
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    // Per-item retry lock to prevent double-click duplicates
    const retryingIds = ref(new Set())

    async function retryKnowledge(id) {
        // Guard: skip if this specific item is already being retried
        if (retryingIds.value.has(id)) return
        retryingIds.value.add(id)
        loading.value = true
        try {
            await api.post(`/knowledge/${id}/retry`)
            await fetchKnowledge() // Refresh list
            startPolling() // Start polling for the retried job
        } catch (e) {
            error.value = e.response?.data?.error || e.message
            throw e
        } finally {
            retryingIds.value.delete(id)
            loading.value = false
        }
    }

    async function requestPublish(id, targetType) {
        loading.value = true
        try {
            await api.post(`/knowledge/${id}/request-publish`, { targetType })
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
            await api.post(`/knowledge/${id}/approve-publish`, { action })
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
            const res = await api.post('/knowledge/extract', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
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
            const res = await api.patch(`/knowledge/${id}`, updates)
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
            const res = await api.get('/knowledge/collections')
            // Handle both paginated and non-paginated response formats
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
            await api.post('/knowledge/collections', payload)
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
            await api.put(`/knowledge/collections/${id}`, payload)
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
            await api.delete(`/knowledge/collections/${id}`)
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
            const res = await api.get(`/knowledge/collections/${id}`)
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
            await api.post(`/knowledge/collections/${collectionId}/map`, { knowledgeId, action })
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

            const res = await api.post('/knowledge/url', payload)
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

            const res = await api.post('/knowledge/text', payload)
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
            const res = await api.get('/knowledge/stats')
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
            const res = await api.get(`/knowledge/${id}/analytics`)
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
        fetchDocumentAnalytics,
        retryingIds,
        stopPolling
    }
})
