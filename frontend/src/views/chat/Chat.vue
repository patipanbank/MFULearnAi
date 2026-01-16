<template>
  <div class="c-app flex-row align-items-stretch overflow-hidden" style="height: calc(100vh - 120px);">
    <!-- Sidebar: Chat History -->
    <CCard class="w-25 h-100 mr-2 d-flex flex-column border-right">
      <CCardHeader class="d-flex justify-content-between align-items-center">
        <strong>History</strong>
        <CButton color="primary" size="sm" @click="createNewChat">
          <CIcon name="cil-plus" size="sm"/> New
        </CButton>
      </CCardHeader>
      <div class="flex-grow-1 overflow-auto p-2">
        <div 
          v-for="chat in chatHistory" 
          :key="chat._id"
          class="p-2 mb-1 rounded cursor-pointer"
          :class="{'bg-light': currentChatId !== chat._id, 'bg-primary text-white': currentChatId === chat._id}"
          @click="loadChat(chat)"
          style="cursor: pointer;"
        >
          <div class="text-truncate font-weight-bold">{{ chat.title || 'New Conversation' }}</div>
          <small class="text-truncate" :class="{'text-white-50': currentChatId === chat._id, 'text-muted': currentChatId !== chat._id}">
            {{ formatDate(chat.updatedAt) }}
          </small>
        </div>
      </div>
    </CCard>

    <!-- Main Chat Area -->
    <CCard class="flex-grow-1 h-100 d-flex flex-column">
      <CCardHeader>
        <strong>{{ currentChatTitle || 'MFULearnAi Chat' }}</strong>
      </CCardHeader>
      
      <!-- Messages -->
      <div class="flex-grow-1 overflow-auto p-3" ref="messagesContainer">
        <div v-if="messages.length === 0" class="text-center text-muted mt-5">
          <h4>Welcome back, {{ currentUser.username }}!</h4>
          <p>Start a new conversation by typing below.</p>
        </div>

        <div v-for="(msg, index) in messages" :key="index" class="d-flex flex-column mb-3">
          <div :class="['d-flex', msg.role === 'user' ? 'justify-content-end' : 'justify-content-start']">
            <div 
              class="p-3 rounded text-wrap" 
              style="max-width: 80%;"
              :class="msg.role === 'user' ? 'bg-primary text-white' : 'bg-light text-dark border'"
            >
              <div v-if="msg.role === 'assistant'" class="font-weight-bold mb-1 text-primary">MFULearnAi</div>
              <div style="white-space: pre-wrap;">{{ msg.content }}</div>
            </div>
          </div>
        </div>
        <div v-if="isGenerating" class="text-left text-muted font-italic ml-2">
          Generating response...
        </div>
      </div>

      <!-- Input Area -->
      <CCardFooter>
        <div class="d-flex">
          <textarea 
            v-model="inputMessage" 
            class="form-control mr-2" 
            rows="2" 
            placeholder="Type your message..."
            @keydown.enter.prevent="sendMessage"
          ></textarea>
          <CButton color="primary" class="px-4" @click="sendMessage" :disabled="isGenerating || !inputMessage.trim()">
            <CIcon name="cil-send"/> Send
          </CButton>
        </div>
      </CCardFooter>
    </CCard>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import Service from '@/service/api'

export default {
  name: 'Chat',
  data() {
    return {
      ws: null,
      inputMessage: '',
      messages: [], // { role: 'user'|'assistant', content: String }
      chatHistory: [],
      currentChatId: null,
      currentChatTitle: '',
      isGenerating: false,
      modelId: 'gpt-4o' // Default model or fetch from config
    }
  },
  computed: {
    ...mapGetters('auth', ['token', 'currentUser'])
  },
  mounted() {
    this.fetchChatHistory();
    this.connectWebSocket();
    this.scrollToBottom();
  },
  beforeDestroy() {
    if (this.ws) {
      this.ws.close();
    }
  },
  methods: {
    connectWebSocket() {
      if (!this.token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // e.g. mfulearnai.ac.th
      // Directly connect using /ws path which Nginx proxies to backend:5001
      const wsUrl = `${protocol}//${host}/ws?token=${this.token}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWsMessage(data);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected. Reconnecting in 3s...');
        setTimeout(this.connectWebSocket, 3000);
      };
      
      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    },

    handleWsMessage(data) {
      if (data.type === 'chat_created') {
        this.currentChatId = data.chatId;
        this.fetchChatHistory(); // Refresh list to show new chat
      } else if (data.type === 'content') {
        this.isGenerating = true;
        // Append content to the last assistant message
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content += data.content;
        } else {
          this.messages.push({ role: 'assistant', content: data.content });
        }
        this.scrollToBottom();
      } else if (data.type === 'complete') {
        this.isGenerating = false;
        this.fetchChatHistory(); // Update title if generated
      } else if (data.type === 'error') {
        this.isGenerating = false;
        alert('Error: ' + data.error);
      }
    },

    async fetchChatHistory() {
      try {
        const response = await Service.chat('get-chats');
        // Backend returns array of chats
        this.chatHistory = response.data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      } catch (error) {
        console.error('Failed to fetch chat history', error);
      }
    },

    async loadChat(chat) {
      if (this.currentChatId === chat._id) return;
      
      this.currentChatId = chat._id;
      this.currentChatTitle = chat.title;
      this.isGenerating = false;

      try {
        const response = await Service.chat('get-chat', { chatId: chat._id });
        const fullChat = response.data;
        // Map backend messages to UI format
        this.messages = fullChat.messages.map(m => ({
          role: m.role,
          content: m.content
        })).filter(m => m.role !== 'system'); // Hide system prompts if any
        
        this.scrollToBottom();
      } catch (error) {
        console.error('Failed to load chat', error);
      }
    },

    createNewChat() {
      this.currentChatId = null;
      this.currentChatTitle = '';
      this.messages = [];
      this.isGenerating = false;
    },

    sendMessage() {
      const text = this.inputMessage.trim();
      if (!text || !this.ws) return;

      // Add user message to UI immediately
      this.messages.push({ role: 'user', content: text });
      this.inputMessage = '';
      this.isGenerating = true;
      this.scrollToBottom();

      // Prepare payload
      const payload = {
        type: 'chat_message', // or implicit based on structure, checked backend source, it expects fields directly
        messages: this.messages.map(m => ({ role: m.role, content: m.content })),
        modelId: this.modelId,
        chatId: this.currentChatId
      };

      this.ws.send(JSON.stringify(payload));
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    },

    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString();
    }
  }
}
</script>

<style scoped>
.text-wrap {
  word-wrap: break-word;
}
</style>
