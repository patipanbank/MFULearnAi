import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import api from '../utils/api'

export const useChatStore = defineStore('chat', () => {
    const messages = ref([])
    const sessions = ref([])
    const currentSessionId = ref(null)
    // Initialize from localStorage if available
    const currentCollectionId = ref(localStorage.getItem('active_collection_id') || null)
    const currentMode = ref('chat') // 'chat' | 'agent'

    // Persist collection selection
    watch(currentCollectionId, (newVal) => {
        if (newVal) {
            localStorage.setItem('active_collection_id', newVal)
        } else {
            localStorage.removeItem('active_collection_id')
        }
    })
    const isLoading = ref(false)
    const isStreaming = ref(false)
    const availableModels = ref([])

    const currentSession = computed(() =>
        sessions.value.find(s => s.sessionId === currentSessionId.value)
    )

    // Load available models
    async function fetchModels() {
        try {
            const token = localStorage.getItem('auth_token')
            if (!token) return

            const response = await fetch('/api/chat/models', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (response.ok) {
                const data = await response.json()
                if (data.models && Array.isArray(data.models)) {
                    availableModels.value = data.models
                }
            }
        } catch (error) {
            console.error('Failed to fetch models:', error)
        }
    }

    // Create new session
    function newSession() {
        currentSessionId.value = `session-${Date.now()}`
        messages.value = []
        return currentSessionId.value
    }

    // Load session history
    async function loadSession(sessionId) {
        if (!sessionId || currentSessionId.value === sessionId && messages.value.length > 0) return

        isLoading.value = true
        try {
            const response = await api.get(`/chat/${sessionId}`)
            messages.value = response.data.messages || []
            currentSessionId.value = sessionId

            // If the session isn't in our list yet (e.g. deep link), we should reload list
            const exists = sessions.value.some(s => s.sessionId === sessionId)
            if (!exists) {
                await loadSessions()
            }
        } catch (error) {
            console.error('Failed to load session:', error)
            // If session not found, might want to redirect to /chat
            currentSessionId.value = null
            messages.value = []
        } finally {
            isLoading.value = false
        }
    }

    // Load user sessions list
    async function loadSessions() {
        try {
            const response = await api.get('/chat')
            sessions.value = response.data.conversations || []
        } catch (error) {
            console.error('Failed to load sessions:', error)
        }
    }

    // Send message with streaming
    async function sendMessage(content, modelId = null, images = [], files = [], mode = 'chat') {
        if ((!content.trim() && images.length === 0 && files.length === 0) || isStreaming.value) return

        // Lazy session creation: if no session, create one now
        if (!currentSessionId.value) {
            newSession()
        }

        // Use passed modelId, or first available, or fallback
        const selectedModel = modelId ||
            (availableModels.value.length > 0 ? availableModels.value[0] : 'anthropic.claude-3-5-sonnet-20240620-v1:0')

        // Add user message
        messages.value.push({
            role: 'user',
            content: content.trim(),
            images: images,
            files: files,
            timestamp: new Date()
        })

        isStreaming.value = true

        // Update session title with first message content locally so it appears in sidebar
        const userMessages = messages.value.filter(m => m.role === 'user')
        if (userMessages.length === 1) {
            // Use the full content, let CSS handle truncation
            const newTitle = content.trim() || 'New Chat'

            // Find existing session in the list
            const sessionIndex = sessions.value.findIndex(s => s.sessionId === currentSessionId.value)

            if (sessionIndex !== -1) {
                // Update existing session
                const session = sessions.value[sessionIndex]
                if (!session.metadata) session.metadata = {}
                session.metadata.title = newTitle
                // Move to top if not already
                if (sessionIndex > 0) {
                    sessions.value.splice(sessionIndex, 1)
                    sessions.value.unshift(session)
                }
            } else {
                // Create new session entry locally
                sessions.value.unshift({
                    sessionId: currentSessionId.value,
                    metadata: { title: newTitle },
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
            }
        }

        // Add placeholder for assistant
        const assistantIndex = messages.value.length
        messages.value.push({
            role: 'assistant',
            content: '', // Start empty
            timestamp: new Date()
        })

        try {
            const token = localStorage.getItem('auth_token')
            console.log(`[ChatStore] Sending request to /api/chat with model: ${selectedModel}...`)

            // Construct FormData for multipart/form-data
            const formData = new FormData()
            formData.append('message', content)
            if (currentSessionId.value) formData.append('sessionId', currentSessionId.value)
            if (selectedModel) formData.append('modelId', selectedModel)
            if (currentCollectionId.value) formData.append('collectionId', currentCollectionId.value)
            formData.append('mode', mode) // Add mode ('chat' or 'agent')

            // Append Images (If any - handling legacy base64 logic or new File logic?)
            // If images are base64 strings (existing logic), pass as JSON string? 
            // Or assume specific handling.
            // Existing logic: images is array of { data: base64, mediaType: ... }
            if (images && images.length > 0) {
                formData.append('images', JSON.stringify(images))
            }

            // Append Files (Real File objects)
            if (files && files.length > 0) {
                files.forEach((file) => {
                    // Start of Selection
                    // Check if 'file' is a native File object or our wrapper?
                    // ChatInput.vue seems to push native File objects if we adhere to new logic, 
                    // BUT previous view of Chat.vue (line 96) showed wrapper object push: 
                    // { type: 'doc', name: file.name, content: text, ... }
                    // Wait, we want to change this to send RAW FILE.
                    // Implementation Plan said: "Update Chat.vue to send Multipart request"
                    // So we must update Chat.vue handleFileUpload as well. 
                    // Assuming Chat.vue will now pass raw File objects in 'files' array to this store action.
                    if (file instanceof File) {
                        formData.append('files', file)
                    } else if (file.rawFile instanceof File) {
                        formData.append('files', file.rawFile)
                    }
                })
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    // 'Content-Type': 'multipart/form-data', // Browser sets boundary automatically
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`Server Error ${response.status}: ${errText}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                // console.log('[ChatStore] Received chunk:', chunk)

                const lines = chunk.split('\n')
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const dataStr = line.replace('data:', '').trim()
                        if (!dataStr || dataStr === '[DONE]') continue

                        try {
                            const data = JSON.parse(dataStr)

                            // 1. Text Delta
                            if (data.text) {
                                messages.value[assistantIndex].content += data.text
                            }

                            // 2. Error from backend (e.g. Bedrock failure)
                            if (data.error) {
                                console.error('[ChatStore] Backend reported error:', data.error)
                                const errorMsg = `\n\n**Error**: ${data.error}`
                                messages.value[assistantIndex].content += errorMsg
                                messages.value[assistantIndex].error = data.error
                            }
                        } catch (e) {
                            // Ignore parse errors for partial chunks
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[ChatStore] Stream error:', error)
            messages.value[assistantIndex].content += `\n\n**System Error**: ${error.message}`
            messages.value[assistantIndex].error = true
        } finally {
            isStreaming.value = false
            console.log('[ChatStore] Stream finished')
        }
    }

    // Reset session state (visual only, no ID created yet)
    function resetSession() {
        currentSessionId.value = null
        messages.value = []
        currentCollectionId.value = null
    }

    // Clear current session (delete using current ID)
    async function clearSession() {
        if (!currentSessionId.value) return
        await deleteSession(currentSessionId.value)
    }

    // Delete a specific session
    async function deleteSession(sessionId) {
        try {
            await api.delete(`/chat/${sessionId}`)
            // Remove from local list
            sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)

            // If deleting current session, clear messages
            if (currentSessionId.value === sessionId) {
                messages.value = []
                currentSessionId.value = null
            }
        } catch (error) {
            console.error('Failed to delete session:', error)
            throw error
        }
    }

    // Initialize models when the store is created
    fetchModels()

    return {
        messages,
        sessions,
        availableModels,
        currentSessionId,
        currentCollectionId,
        currentMode,
        currentSession,
        isLoading,
        isStreaming,
        newSession,
        resetSession,
        loadSession,
        loadSessions,
        fetchModels,
        sendMessage,
        clearSession,
        deleteSession
    }
})
