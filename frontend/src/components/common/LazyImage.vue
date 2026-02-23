<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: 'image' },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  secure: { type: Boolean, default: false }
})

const authStore = useAuthStore()
const displaySrc = ref('')
const state = ref('idle') // idle | loading | loaded | error
const imgRef = ref(null)
let observer = null

onMounted(() => {
  // Use IntersectionObserver
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        loadImage()
        observer.disconnect()
      }
    },
    {
      scrollMargin: '200px',
      rootMargin: '200px',
      threshold: 0.01
    }
  )
  if (imgRef.value) observer.observe(imgRef.value)

  setTimeout(() => {
    if (state.value === 'idle' && imgRef.value) {
      loadImage()
    }
  }, 3000)
})

onUnmounted(() => {
  if (displaySrc.value?.startsWith('blob:')) {
    window.URL.revokeObjectURL(displaySrc.value)
  }
})

const loadImage = async () => {
  if (state.value === 'loaded' || state.value === 'loading') return
  
  state.value = 'loading'
  
  if (props.secure && props.src.includes('/api/')) {
    try {
      const resp = await axios.get(props.src, {
        headers: { Authorization: `Bearer ${authStore.token}` },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(resp.data)
      displaySrc.value = url
      state.value = 'loaded'
    } catch (e) {
      console.error('Secure image load failed', e)
      state.value = 'error'
    }
  } else {
    // Standard load
    displaySrc.value = props.src
    const img = new Image()
    img.onload = () => { state.value = 'loaded' }
    img.onerror = () => { state.value = 'error' }
    img.src = props.src
  }
}
const emit = defineEmits(['click'])

const handleClick = () => {
  if (state.value === 'loaded') {
    emit('click', displaySrc.value)
  }
}
</script>

<template>
  <div ref="imgRef" class="lazy-image-wrapper" @click="handleClick">
    
    <!-- Placeholder / Skeleton -->
    <div v-if="state === 'idle' || state === 'loading'" class="lazy-placeholder">
      <div class="skeleton-shimmer" />
      <svg v-if="state === 'idle'" class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </div>

    <!-- Loaded Image -->
    <img
      v-if="state === 'loaded'"
      :src="displaySrc"
      :alt="alt"
      class="lazy-image"
    />

    <!-- Error State -->
    <div v-if="state === 'error'" class="lazy-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>โหลดภาพไม่สำเร็จ</span>
    </div>

  </div>
</template>

<style scoped>
.lazy-image-wrapper {
  position: relative;
  border-radius: 10px; /* Slight adjustment to match previous theme */
  overflow: hidden;
  background: var(--color-bg-secondary);
  min-width: 120px;
  min-height: 80px;
  max-width: 360px;
  border: 1px solid var(--color-border); /* Add border to match prev style */
}

/* Skeleton */
.lazy-placeholder {
  width: 100%;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.skeleton-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--color-bg-secondary) 25%,
    var(--color-bg-tertiary) 50%,
    var(--color-bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.placeholder-icon {
  width: 36px;
  height: 36px;
  color: var(--color-text-muted);
  opacity: 0.4;
  position: relative;
  z-index: 1;
}

/* Loaded */
.lazy-image {
  display: block;
  width: 100%;
  height: auto;
  animation: fadeIn 0.3s ease;
  object-fit: cover; /* Maintain aspect ratio logic */
  cursor: zoom-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Error */
.lazy-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--color-text-muted);
  font-size: 12px;
  min-height: 100px;
}
</style>
