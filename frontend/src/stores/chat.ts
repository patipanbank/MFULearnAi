import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  updatedAt: Date
  pinned?: boolean
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const isLoading = ref(false)

  // Mock initial data
  sessions.value = [
    {
      id: '1',
      title: 'Project Analysis',
      updatedAt: new Date(),
      messages: [
        { id: '1', role: 'user', content: 'Analyze this codebase.', timestamp: new Date() },
        { id: '2', role: 'assistant', content: 'Sure, I can help with that. What specific aspects are you interested in?', timestamp: new Date() }
      ]
    },
    {
      id: '2',
      title: 'Vue 3 Questions',
      updatedAt: new Date(Date.now() - 86400000), // Yesterday
      messages: [
        { id: '1', role: 'user', content: 'How do I use Pinia?', timestamp: new Date() }
      ]
    }
  ]

  function createNewChat() {
    const newId = Date.now().toString()
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      messages: [],
      updatedAt: new Date()
    }
    sessions.value.unshift(newSession)
    currentSessionId.value = newId
    return newId
  }

  function selectChat(id: string) {
    currentSessionId.value = id
  }

  async function sendMessage(content: string) {
    if (!currentSessionId.value) {
      createNewChat()
    }
    
    const session = sessions.value.find(s => s.id === currentSessionId.value)
    if (!session) return

    // Add user message
    session.messages.push({
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    })

    isLoading.value = true

    // Simulate API delay and streaming
    setTimeout(() => {
      isLoading.value = false
      session.messages.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received your message: "${content}". This is a simulated response.`,
        timestamp: new Date()
      })
      
      // Update title if it's the first message
      if (session.messages.length === 2 && session.title === 'New Chat') {
        session.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
      }
    }, 1000)
  }

  return {
    sessions,
    currentSessionId,
    isLoading,
    createNewChat,
    selectChat,
    sendMessage
  }
})
