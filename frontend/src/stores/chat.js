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

            // Append Files (Raw File objects from Chat.vue)
            if (files && files.length > 0) {
                files.forEach((file) => {
                    if (file instanceof File) {
                        formData.append('files', file)
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

                            // 2. Status Updates (e.g. "Executing tool...")
                            if (data.type === 'status') {
                                messages.value[assistantIndex].status = data.message
                            }

                            // 3. Intent Detection
                            if (data.type === 'intent') {
                                messages.value[assistantIndex].intent = data.intent
                            }

                            // 4. Final Metadata (e.g. usedRAG, tokenPressure)
                            if (data.type === 'metadata') {
                                messages.value[assistantIndex].meta = data.metadata
                            }

                            // 5. File Processing Progress
                            // 5. File Processing Progress
                            if (data.type === 'file_progress') {
                                // Target the USER message (preceding the assistant)
                                const userMsgIndex = assistantIndex - 1;
                                if (userMsgIndex >= 0 && messages.value[userMsgIndex].role === 'user') {
                                    const userMsg = messages.value[userMsgIndex];

                                    // Initialize fileProgress object if missing
                                    if (!userMsg.fileProgress) {
                                        userMsg.fileProgress = {}
                                    }
                                    // Store progress by file index or name
                                    userMsg.fileProgress = {
                                        currentFile: data.fileName,
                                        currentindex: data.fileIndex,
                                        totalFiles: data.totalFiles,
                                        stage: data.stage,
                                        percent: data.percent,
                                        detail: data.detail
                                    }
                                }

                                // Legacy/Fallback: Status text removed as per user request (UI Consolidation)
                                // messages.value[assistantIndex].status = data.detail || `Processing ${data.fileName}...`
                            }

                            // 6. Error from backend (e.g. Bedrock failure)
                            if (data.error) {
                                console.error('[ChatStore] Backend reported error:', data.error)
                                const errorMsg = `\n\n**Error**: ${data.error}`
                                messages.value[assistantIndex].content += errorMsg
                                messages.value[assistantIndex].error = data.error
                            }

                            // 8. Title Update
                            if (data.type === 'title') {
                                // Update current session title locally
                                const session = sessions.value.find(s => s.sessionId === currentSessionId.value)
                                if (session) {
                                    if (!session.metadata) session.metadata = {}
                                    session.metadata.title = data.title
                                    // Trigger reactivity if needed, usually direct mutation works in Pinia/Vue ref
                                }
                            }

                            // 7. File Persisted (Real-time update)
                            if (data.type === 'file_uploaded') {
                                const userMsgIndex = assistantIndex - 1;
                                if (userMsgIndex >= 0 && messages.value[userMsgIndex].role === 'user') {
                                    const userMsg = messages.value[userMsgIndex];

                                    if (!userMsg.attachments) userMsg.attachments = [];

                                    // avoid duplicates
                                    const exists = userMsg.attachments.some(a => a.fileName === data.fileName);
                                    if (!exists) {
                                        userMsg.attachments.push({
                                            ...data.metadata,
                                            fileName: data.fileName || data.metadata.fileName,
                                            fileSize: data.metadata.size || data.metadata.fileSize
                                        });
                                    }

                                    // Remove from temporary files list to avoid double display
                                    if (userMsg.files) {
                                        userMsg.files = userMsg.files.filter(f => f.name !== data.fileName);
                                    }
                                }
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
            // Trigger token usage update on frontend
            const authStore = (await import('./auth')).useAuthStore()
            authStore.tokenUpdateTrigger++
            console.log('[ChatStore] Stream finished and token update triggered')
        }
    }

    // Reset session state (visual only, no ID created yet)
    function resetSession() {
        currentSessionId.value = null
        messages.value = []
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
