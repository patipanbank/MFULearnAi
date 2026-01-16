<script setup>
defineProps({
  userName: {
    type: String,
    default: ''
  },
  envName: {
    type: String,
    default: 'MFULearnAI'
  },
  prompts: {
    type: Array,
    default: () => [
      { icon: '📚', text: 'อธิบายหลักสูตรของมหาวิทยาลัยแม่ฟ้าหลวง' },
      { icon: '💡', text: 'แนะนำวิธีการเรียนที่มีประสิทธิภาพ' },
      { icon: '🔬', text: 'ช่วยอธิบายหลักการทำงานของ AI' },
      { icon: '📝', text: 'ช่วยเขียนโค้ด Python สำหรับ...' }
    ]
  }
})

const emit = defineEmits(['select-prompt'])
</script>

<template>
  <div class="welcome-screen">
    <div class="welcome-content">
      <div class="welcome-icon">
        <span>👋</span>
      </div>
      
      <h2>สวัสดี{{ userName ? ', ' + userName : '' }}!</h2>
      <p>ฉันคือ AI Assistant ของ {{ envName }} พร้อมช่วยเหลือคุณ</p>
      
      <div class="suggested-prompts">
        <h3>ลองถามคำถามเหล่านี้:</h3>
        <div class="prompts-grid">
          <button 
            v-for="(prompt, idx) in prompts" 
            :key="idx"
            class="prompt-card glass-light"
            @click="emit('select-prompt', prompt.text)"
          >
            <span class="prompt-icon">{{ prompt.icon }}</span>
            <span class="prompt-text">{{ prompt.text }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-screen {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.welcome-content {
  text-align: center;
  max-width: 600px;
}

.welcome-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  box-shadow: 0 0 40px var(--glow-primary);
  animation: bounce-slow 3s ease-in-out infinite;
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.welcome-content h2 {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.welcome-content p {
  font-size: 16px;
  color: var(--color-text-muted);
  margin-bottom: 40px;
}

.suggested-prompts h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

.prompts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.prompt-card {
  padding: 16px;
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.05);
}

.prompt-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.prompt-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 8px;
}

.prompt-text {
  font-size: 13px;
  color: var(--color-text);
  display: block;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .prompts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
