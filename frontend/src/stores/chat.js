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
            } else if (response.status === 401 || response.status === 403) {
                const authStore = (await import('./auth')).useAuthStore()
                authStore.logout()
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

    // AbortController for cancelling requests
    let abortController = null

    // Stop generation
    function stopGeneration() {
        if (abortController) {
            abortController.abort()
            abortController = null
            isStreaming.value = false

            // Optional: Add a system message or mark last message as stopped
            if (messages.value.length > 0) {
                const lastMsg = messages.value[messages.value.length - 1]
                if (lastMsg.role === 'assistant' && !lastMsg.content) {
                    lastMsg.content = '*(Stopped by user)*'
                }
            }
        }
    }

    // Send message with Socket.IO real-time events
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

        // Reset and create new AbortController
        if (abortController) abortController.abort()
        abortController = new AbortController()

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

        const assistantIndex = messages.value.length
        messages.value.push({
            role: 'assistant',
            content: '',
            status: '',
            agentEvents: [], // Pre-init for Vue reactivity — Agent Flow timeline needs this
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

            // Append Images
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

            // POST returns { traceId, sessionId } immediately (no streaming)
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
                signal: abortController.signal
            })

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    const authStore = (await import('./auth')).useAuthStore()
                    authStore.logout()
                    return
                }

                const errText = await response.text()
                throw new Error(`Server Error ${response.status}: ${errText}`)
            }

            const { traceId, sessionId: returnedSessionId } = await response.json()
            console.log(`[ChatStore] Got traceId=${traceId}, sessionId=${returnedSessionId}`)

            // Update sessionId if server assigned a new one
            if (returnedSessionId && returnedSessionId !== currentSessionId.value) {
                currentSessionId.value = returnedSessionId
            }

            // ── Listen for real-time events via Socket.IO ──
            const { getSocket } = await import('../services/socket.js')
            const socket = getSocket()

            if (!socket) {
                throw new Error('Socket.IO not connected — please refresh the page')
            }

            // Create a promise that resolves when agent completes
            await new Promise((resolve, reject) => {
                const handleEvent = (data) => {
                    // Only process events for this trace
                    if (data.traceId !== traceId) return

                    // Helper: ensure agentEvents array exists
                    const ensureEvents = () => {
                        if (!messages.value[assistantIndex].agentEvents) {
                            messages.value[assistantIndex].agentEvents = []
                        }
                    }

                    // ══ Agent Flow Events ══
                    if (['agent_start', 'context_loaded', 'agent_step', 'thinking',
                        'answer_start', 'answer_done', 'step_usage', 'agent_complete'].includes(data.type)) {
                        ensureEvents()
                        messages.value[assistantIndex].agentEvents.push({
                            type: data.type,
                            ...data,
                            receivedAt: Date.now()
                        })
                    }

                    // Tool events
                    if (data.type === 'tool_start') {
                        ensureEvents()
                        messages.value[assistantIndex].agentEvents.push({
                            type: 'tool_start',
                            toolName: data.toolName,
                            input: data.input,
                            step: data.step,
                            receivedAt: Date.now()
                        })
                    }

                    if (data.type === 'tool_complete') {
                        ensureEvents()
                        messages.value[assistantIndex].agentEvents.push({
                            type: 'tool_complete',
                            toolName: data.toolName,
                            success: data.success,
                            resultPreview: data.resultPreview,
                            durationMs: data.durationMs,
                            step: data.step,
                            receivedAt: Date.now()
                        })
                    }

                    // ══ Answer Streaming (Token-by-token) ══
                    if (data.type === 'answer_delta') {
                        messages.value[assistantIndex].content += data.delta
                    }

                    // Status Updates
                    if (data.type === 'status') {
                        messages.value[assistantIndex].status = data.message
                    }

                    // Thinking status
                    if (data.type === 'thinking') {
                        messages.value[assistantIndex].status = data.message
                    }

                    // Intent Detection
                    if (data.type === 'intent') {
                        messages.value[assistantIndex].intent = data.intent
                    }

                    // Final Metadata
                    if (data.type === 'metadata') {
                        messages.value[assistantIndex].meta = data.metadata
                    }

                    // File Processing Progress
                    if (data.type === 'file_progress') {
                        const userMsgIndex = assistantIndex - 1;
                        if (userMsgIndex >= 0 && messages.value[userMsgIndex].role === 'user') {
                            const userMsg = messages.value[userMsgIndex];
                            if (!userMsg.fileProgress) userMsg.fileProgress = {}
                            userMsg.fileProgress = {
                                currentFile: data.fileName,
                                currentindex: data.fileIndex,
                                totalFiles: data.totalFiles,
                                stage: data.stage,
                                percent: data.percent,
                                detail: data.detail
                            }
                        }
                    }

                    // Error from backend
                    if (data.type === 'error' || data.error) {
                        console.error('[ChatStore] Backend reported error:', data.error)
                        const errorMsg = `\n\n**Error**: ${data.error}`
                        messages.value[assistantIndex].content += errorMsg
                        messages.value[assistantIndex].error = data.error
                    }

                    // Title Update
                    if (data.type === 'title') {
                        const session = sessions.value.find(s => s.sessionId === currentSessionId.value)
                        if (session) {
                            if (!session.metadata) session.metadata = {}
                            session.metadata.title = data.title
                        }
                    }

                    // File Persisted
                    if (data.type === 'file_uploaded') {
                        const userMsgIndex = assistantIndex - 1;
                        if (userMsgIndex >= 0 && messages.value[userMsgIndex].role === 'user') {
                            const userMsg = messages.value[userMsgIndex];
                            if (!userMsg.attachments) userMsg.attachments = [];
                            const exists = userMsg.attachments.some(a => a.fileName === data.fileName);
                            if (!exists) {
                                userMsg.attachments.push({
                                    ...data.metadata,
                                    fileName: data.fileName || data.metadata?.fileName,
                                    fileSize: data.metadata?.size || data.metadata?.fileSize
                                });
                            }
                            if (userMsg.files) {
                                userMsg.files = userMsg.files.filter(f => f.name !== data.fileName);
                            }
                        }
                    }

                    // ══ Completion: resolve the promise ══
                    if (data.type === 'agent_complete') {
                        socket.off('agent:event', handleEvent)
                        resolve()
                    }
                }

                // Register Socket.IO listener
                socket.on('agent:event', handleEvent)

                // Timeout safety: if no completion after 5 min, cleanup
                const timeout = setTimeout(() => {
                    socket.off('agent:event', handleEvent)
                    reject(new Error('Agent workflow timed out'))
                }, 5 * 60 * 1000)

                // Cleanup on abort
                abortController.signal.addEventListener('abort', () => {
                    socket.off('agent:event', handleEvent)
                    clearTimeout(timeout)
                    resolve() // Don't reject on user abort
                })
            })

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[ChatStore] Request Aborted')
            } else {
                console.error('[ChatStore] Error:', error)
                messages.value[assistantIndex].content += `\n\n**System Error**: ${error.message}`
                messages.value[assistantIndex].error = true
            }
        } finally {
            isStreaming.value = false
            abortController = null
            // Trigger token usage update on frontend
            const authStore = (await import('./auth')).useAuthStore()
            authStore.tokenUpdateTrigger++
            console.log('[ChatStore] Finished and token update triggered')
        }
    }

    // Reset session state (visual only, no ID created yet)
    function resetSession() {
        currentSessionId.value = null
        messages.value = []
        abortController = null
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
        stopGeneration,
        clearSession,
        deleteSession
    }
})
