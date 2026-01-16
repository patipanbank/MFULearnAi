<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const messages = ref([])
const inputMessage = ref('')
const isLoading = ref(false)
const messagesContainer = ref(null)
const user = ref(null)

onMounted(() => {
  const userStr = localStorage.getItem('user_info')
  const token = localStorage.getItem('auth_token')
  
  if (!userStr || !token) {
    router.push('/login')
    return
  }
  
  user.value = JSON.parse(userStr)
  
  // Setup Axios interceptor for this component scope or globally later
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
})

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  if (!inputMessage.value.trim()) return

  const userMsg = inputMessage.value
  messages.value.push({ role: 'user', content: userMsg })
  inputMessage.value = ''
  isLoading.value = true
  scrollToBottom()

  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message: userMsg, modelId: 'anthropic.claude-v2' })
    })

    if (!response.ok) throw new Error('Network response was not ok')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let botMessageContent = ''
    
    // Add placeholder for bot message
    messages.value.push({ role: 'assistant', content: '' })
    const botMessageIndex = messages.value.length - 1

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      // SSE parsing simple logic (splitting by data: )
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (line.trim().startsWith('data:')) {
           const dataStr = line.replace('data:', '').trim()
           if (dataStr === '[DONE]') break
           try {
             const data = JSON.parse(dataStr)
             if (data.text) {
               botMessageContent += data.text
               messages.value[botMessageIndex].content = botMessageContent
               scrollToBottom()
             }
           } catch (e) {
             // ignore json parse error for partial chunks
           }
        }
      }
    }

  } catch (error) {
    console.error(error)
    messages.value.push({ role: 'system', content: 'Error: Could not connect to AI service.' })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}
</script>

<template>
  <div class="c-app flex-row align-items-center chat-container">
     <div class="sidebar bg-dark text-white p-3">
        <h5>MFULearn AI</h5>
        <div class="mt-4">
           <small>User: {{ user?.username || 'Guest' }}</small>
        </div>
        <hr/>
        <button class="btn btn-outline-light w-100" @click="router.push('/login')">Logout</button>
     </div>
     
     <div class="main-content flex-grow-1 d-flex flex-column h-100">
        <div class="messages p-4 flex-grow-1" ref="messagesContainer" style="overflow-y: auto; height: 80vh;">
           <div v-if="messages.length === 0" class="text-center text-muted mt-5">
              <h3>Welcome to MFULearn AI</h3>
              <p>Start chatting with the assistant.</p>
           </div>
           
           <div v-for="(msg, idx) in messages" :key="idx" class="mb-3 d-flex" :class="msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'">
              <div class="card p-2" :class="msg.role === 'user' ? 'bg-primary text-white' : 'bg-light'" style="max-width: 70%;">
                 <div class="card-body p-1">
                    {{ msg.content }}
                 </div>
              </div>
           </div>
           
           <div v-if="isLoading" class="text-center">
              <span class="spinner-border spinner-border-sm"></span> Thinking...
           </div>
        </div>
        
        <div class="input-area p-3 bg-white border-top">
           <form @submit.prevent="sendMessage" class="d-flex gap-2">
              <input v-model="inputMessage" class="form-control" placeholder="Type a message..." :disabled="isLoading"/>
              <button type="submit" class="btn btn-primary" :disabled="isLoading">Send</button>
           </form>
        </div>
     </div>
  </div>
</template>

<style scoped>
.chat-container {
  height: 100vh;
  display: flex;
}
.sidebar {
  width: 250px;
  flex-shrink: 0;
}
</style>
