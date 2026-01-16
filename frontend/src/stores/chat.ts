import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from './auth'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string | Date
  files?: any[]
}

export interface ChatSession {
  id: string
  chatname?: string // Backend uses 'chatname'
  title: string     // Frontend alias
  messages: Message[]
  updatedAt: string | Date
  pinned?: boolean
  modelId?: string
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const isLoading = ref(false)
  const authStore = useAuthStore()

  async function fetchChats() {
    if (!authStore.isAuthenticated) return
    try {
      const response = await axios.get('/api/chat/chats?limit=50')
      sessions.value = response.data.map((chat: any) => ({
        id: chat._id || chat.id,
        title: chat.chatname || 'Untitled Chat',
        messages: chat.messages || [],
        updatedAt: chat.updatedAt,
        pinned: chat.isPinned,
        modelId: chat.modelId
      }))
    } catch (error) {
      console.error('Failed to fetch chats', error)
    }
  }

  function createNewChat() {
    currentSessionId.value = null // Null means "new chat mode"
    // We don't push to sessions until we save it
  }

  function selectChat(id: string) {
    currentSessionId.value = id
    // Optionally fetch full chat details if not fully loaded
    // fetchChatDetails(id)
  }

  async function sendMessage(content: string, files: any[] = []) {
    const authStore = useAuthStore()
    const tempUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      files
    }

    let activeSession: ChatSession | undefined

    if (currentSessionId.value) {
      activeSession = sessions.value.find(s => s.id === currentSessionId.value)
      if (activeSession) {
        activeSession.messages.push(tempUserMsg)
      }
    } else {
      // Create temporary session structure for UI
      activeSession = {
        id: 'temp-' + Date.now(),
        title: 'New Chat',
        messages: [tempUserMsg],
        updatedAt: new Date(),
        modelId: 'default'
      }
      sessions.value.unshift(activeSession)
      currentSessionId.value = activeSession.id
    }

    if (!activeSession) return

    isLoading.value = true

    // Prepare messages payload for streaming
    // Map to backend format if needed (usually just role/content)
    const messagesPayload = activeSession.messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    // Placeholder for assistant message
    const tempAssistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '', // Start empty
      timestamp: new Date()
    }
    activeSession.messages.push(tempAssistantMsg)

    try {
      // Start SSE Stream
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        },
        body: JSON.stringify({
          messages: messagesPayload,
          modelId: 'default', // Using default
          collectionName: ''  // Optional RAG collection
        })
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false

      while (!done) {
        const { value, done: Done } = await reader.read()
        done = Done
        if (value) {
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6))
                if (data.content) {
                  tempAssistantMsg.content += data.content
                  // Scroll handled by View watcher
                }
              } catch (e) {
                // Ignore parsing errors for partial chunks
              }
            }
          }
        }
      }

      // Sync with Backend (Save/Update)
      if (currentSessionId.value?.startsWith('temp-')) {
        // Create new chat
        const saveRes = await axios.post('/api/chat/history', {
          messages: activeSession.messages,
          modelId: 'default'
        })
        
        // Update local session with real ID
        const realId = saveRes.data._id || saveRes.data.id
        
        // Replace temp ID
        activeSession.id = realId
        currentSessionId.value = realId
        
        // Update alias if needed
        activeSession.title = saveRes.data.chatname || 'New Chat'
        
      } else {
        // Update existing chat
        await axios.put(`/api/chat/history/${currentSessionId.value}`, {
          messages: activeSession.messages
        })
      }
      
      // Update local timestamp
      activeSession.updatedAt = new Date()

    } catch (error) {
      console.error('Chat error:', error)
      tempAssistantMsg.content += '\n[Error: Failed to generate response]'
    } finally {
      isLoading.value = false
    }
  }

  return {
    sessions,
    currentSessionId,
    isLoading,
    fetchChats,
    createNewChat,
    selectChat,
    sendMessage
  }
})
