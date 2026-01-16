import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../utils/api'

export const useChatStore = defineStore('chat', () => {
    const messages = ref([])
    const sessions = ref([])
    const currentSessionId = ref(null)
    const currentCollectionId = ref(null)
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
        isLoading.value = true
        try {
            const response = await api.get(`/chat/${sessionId}`)
            messages.value = response.data.messages || []
            currentSessionId.value = sessionId
        } catch (error) {
            console.error('Failed to load session:', error)
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
    async function sendMessage(content, modelId = null) {
        if (!content.trim() || isStreaming.value) return

        // Use passed modelId, or first available, or fallback
        const selectedModel = modelId ||
            (availableModels.value.length > 0 ? availableModels.value[0] : 'anthropic.claude-3-5-sonnet-20240620-v1:0')

        // Add user message
        messages.value.push({
            role: 'user',
            content: content.trim(),
            timestamp: new Date()
        })

        isStreaming.value = true

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

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: content,
                    sessionId: currentSessionId.value,
                    modelId: selectedModel,
                    collectionId: currentCollectionId.value
                })
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

    // Clear current session
    async function clearSession() {
        if (!currentSessionId.value) return

        try {
            await api.delete(`/chat/${currentSessionId.value}`)
            messages.value = []
        } catch (error) {
            console.error('Failed to clear session:', error)
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
        currentSession,
        isLoading,
        isStreaming,
        newSession,
        loadSession,
        loadSessions,
        fetchModels,
        sendMessage,
        clearSession
    }
})
