<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useChatStore } from '../stores/chat'
import { 
  Send, 
  Plus, 
  MessageSquare, 
  Paperclip,
  Bot,
  User,
  Edit2
} from 'lucide-vue-next'

const chatStore = useChatStore()
const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// Add onMounted to fetch chats
import { onMounted } from 'vue'
onMounted(() => {
  chatStore.fetchChats()
})

const currentSession = computed(() => 
  chatStore.sessions.find(s => s.id === chatStore.currentSessionId)
)

const sortedSessions = computed(() => {
  return [...chatStore.sessions].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
})

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(() => currentSession.value?.messages.length, scrollToBottom)

const handleSend = async () => {
  if (!messageInput.value.trim() || chatStore.isLoading) return
  
  const content = messageInput.value
  messageInput.value = ''
  await chatStore.sendMessage(content)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="flex h-[calc(100vh-4rem-2rem)] lg:h-[calc(100vh-4rem)] -m-4 lg:-m-6 bg-white overflow-hidden rounded-2xl shadow-sm border border-gray-200">
    
    <!-- Chat History Sidebar -->
    <div class="w-80 border-r border-gray-200 bg-gray-50 flex flex-col hidden md:flex">
      <div class="p-4">
        <button 
          @click="chatStore.createNewChat()"
          class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 text-gray-700 rounded-xl transition-all shadow-sm font-medium"
        >
          <Plus class="w-5 h-5" />
          New Chat
        </button>
      </div>
      
      <div class="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        <div 
          v-for="session in sortedSessions" 
          :key="session.id"
          @click="chatStore.selectChat(session.id)"
          class="group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all border border-transparent"
          :class="chatStore.currentSessionId === session.id ? 'bg-white border-gray-200 shadow-sm' : 'hover:bg-gray-100'"
        >
          <MessageSquare class="w-5 h-5 text-gray-400 shrink-0" />
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-medium text-gray-900 truncate">{{ session.title }}</h3>
            <p class="text-xs text-gray-500 truncate">
              {{ new Date(session.updatedAt).toLocaleDateString() }}
            </p>
          </div>
          <!-- Hover Actions -->
          <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
             <!-- Placeholder for rename/delete functionality -->
             <button class="p-1 hover:bg-gray-200 rounded text-gray-500"><Edit2 class="w-3 h-3" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Area -->
    <div class="flex-1 flex flex-col min-w-0 bg-white">
      
      <!-- Messages -->
      <div 
        v-if="currentSession" 
        class="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6"
        ref="messagesContainer"
      >
        <div v-if="currentSession.messages.length === 0" class="h-full flex flex-col items-center justify-center text-center opacity-50">
           <Bot class="w-16 h-16 text-gray-300 mb-4" />
           <h3 class="text-xl font-semibold text-gray-700">How can I help you today?</h3>
        </div>

        <div 
          v-for="msg in currentSession.messages" 
          :key="msg.id"
          class="flex gap-4 max-w-4xl mx-auto"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <!-- Assistant Avatar -->
          <div v-if="msg.role === 'assistant'" class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shrink-0 mt-1">
            <Bot class="w-5 h-5 text-white" />
          </div>

          <!-- Message Bubble -->
          <div 
            class="rounded-2xl px-5 py-3.5 max-w-[85%] sm:max-w-[75%] shadow-sm"
            :class="[
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-gray-100 text-gray-800 rounded-bl-none'
            ]"
          >
            <div class="prose prose-sm max-w-none break-words" :class="msg.role === 'user' ? 'prose-invert' : ''">
               {{ msg.content }}
            </div>
            <div 
               class="text-[10px] mt-1 opacity-70 flex justify-end"
               :class="msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'"
            >
               {{ new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
            </div>
          </div>

          <!-- User Avatar -->
          <div v-if="msg.role === 'user'" class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1">
            <User class="w-5 h-5 text-gray-500" />
          </div>
        </div>

        <!-- Loading Indicator -->
        <div v-if="chatStore.isLoading" class="flex gap-4 max-w-4xl mx-auto">
           <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shrink-0 mt-1">
            <Bot class="w-5 h-5 text-white" />
          </div>
          <div class="bg-gray-100 rounded-2xl rounded-bl-none px-5 py-4">
            <div class="flex gap-1">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State (No Session) -->
      <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-500">
        <p>Select a chat or start a new conversation.</p>
        <button 
          @click="chatStore.createNewChat()"
          class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Start New Chat
        </button>
      </div>

      <!-- Input Area -->
      <div class="p-4 bg-white border-t border-gray-200">
        <div class="max-w-4xl mx-auto relative">
          <textarea
            v-model="messageInput"
            @keydown="handleKeydown"
            placeholder="Type your message..."
            class="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none max-h-32 min-h-[52px]"
            rows="1"
          ></textarea>
          
          <div class="absolute right-2 bottom-2 flex items-center gap-1">
            <button 
              class="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              title="Attach File"
            >
              <Paperclip class="w-5 h-5" />
            </button>
            <button 
              @click="handleSend"
              :disabled="!messageInput.trim() || chatStore.isLoading"
              class="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send class="w-5 h-5" />
            </button>
          </div>
        </div>
        <p class="text-center text-xs text-gray-400 mt-2">
          AI can make mistakes. Please verify important information.
        </p>
      </div>

    </div>
  </div>
</template>
