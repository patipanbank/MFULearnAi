<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: 'image' },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
})

const state = ref('idle') // idle | loading | loaded | error
const imgRef = ref(null)
let observer = null

onMounted(() => {
  // Use IntersectionObserver — load only when image enters viewport
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        loadImage()
        observer.disconnect()
      }
    },
    { rootMargin: '100px' } // Start loading 100px before viewport
  )
  if (imgRef.value) observer.observe(imgRef.value)
})

onUnmounted(() => observer?.disconnect())

const loadImage = () => {
  state.value = 'loading'
  const img = new Image()
  img.onload = () => { state.value = 'loaded' }
  img.onerror = () => { state.value = 'error' }
  img.src = props.src
}
</script>

<template>
  <div ref="imgRef" class="lazy-image-wrapper">
    
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
      :src="src"
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
