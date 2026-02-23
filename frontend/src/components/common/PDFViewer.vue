<script setup>
import { ref, computed, watch } from 'vue'
import VuePdfEmbed from 'vue-pdf-embed'
import { useModalKeyboard } from '@/composables/useModalKeyboard'

// Essential styles for PDF.js text layer (if needed later)
// import 'vue-pdf-embed/dist/style/index.css' 
// Note: vue-pdf-embed 2.x might optimize css

const props = defineProps({
  src: { type: String, required: true },
  page: { type: Number, default: 1 },
  // bbox: [x, y, w, h] normalized (0-1)
  // Backend MUST guarantee normalized coordinates, or we need a prop to specify 'absolute' vs 'normalized'
  // Contract says: 11.4 Coordinates: "normalized or 72dpi depending on ingestion"
  // We will assume NORMALIZED for now as it's scale-invariant.
  highlightRect: { type: Array, default: null }, 
  fileName: { type: String, default: 'Document' },
  isOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const pdfRef = ref(null)
const modalRef = ref(null)
const isLoading = ref(true)

// ── Keyboard support ──
useModalKeyboard({
  onClose: () => emit('close'),
  modalRef,
})
const pageCount = ref(0)
const currentPage = ref(props.page)

watch(() => props.page, (val) => {
    currentPage.value = val || 1
})

watch(() => props.isOpen, (val) => {
    if (val) {
        currentPage.value = props.page || 1
        isLoading.value = true
    }
})

// Compute overlay style
const highlightStyle = computed(() => {
    if (!props.highlightRect || props.highlightRect.length !== 4) return null
    
    const [x, y, w, h] = props.highlightRect
    
    // Check if likely normalized (all < 2.0)
    // If backend sends PDF Points (0-600+), we need to know page dimension.
    // LIMITATION: vue-pdf-embed doesn't easily expose page dimensions before render.
    // CRITICAL ASSUMPTION: Backend sends NORMALIZED coordinates [0..1]
    
    // Robust check: if any val > 1, assume absolute and we might be wrong scale
    // Ideally backend sends normalized. 
    
    return {
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`
    }
})

const handleDocumentLoad = (doc) => {
    pageCount.value = doc.numPages
    isLoading.value = false
}

const handlePageChange = (p) => {
    if (p < 1 || p > pageCount.value) return
    currentPage.value = p
}

const close = () => {
    emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="pdf-modal-overlay" @click.self="close">
    <div ref="modalRef" class="pdf-modal-container">
      <!-- Header -->
      <div class="pdf-header">
        <div class="file-info">
            <span class="file-icon">📄</span>
            <span class="file-name">{{ fileName }}</span>
        </div>
        <div class="controls">
            <button @click="handlePageChange(currentPage - 1)" :disabled="currentPage <= 1" class="page-btn">←</button>
            <span class="page-indicator">Page {{ currentPage }} / {{ pageCount || '-' }}</span>
            <button @click="handlePageChange(currentPage + 1)" :disabled="currentPage >= pageCount" class="page-btn">→</button>
        </div>
        <button class="close-btn" @click="close">&times;</button>
      </div>

      <!-- Viewer Body -->
      <div class="pdf-body">
        <div v-if="isLoading" class="loader">
            <div class="spinner"></div>
            Loading Document...
        </div>

        <div class="pdf-wrapper">
             <VuePdfEmbed 
                ref="pdfRef"
                :source="src"
                :page="currentPage"
                @loaded="handleDocumentLoad"
                class="pdf-canvas"
             />
             
             <!-- Highlight Overlay -->
             <!-- We overlay absolute div on top of the rendered page. 
                  Constraint: vue-pdf-embed renders the page. We rely on it filling the wrapper relative.
             -->
             <div v-if="!isLoading && highlightStyle" class="highlight-layer">
                 <div class="highlight-rect" :style="highlightStyle">
                    <!-- Optional: Pulse animation or tooltip -->
                    <span class="highlight-label">Cited Content</span>
                 </div>
             </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100svh; /* Safari Fix */
  background: rgba(0, 0, 0, 0.75);
  z-index: 9999; /* Highest Z-index */
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

.pdf-modal-container {
  width: 90vw;
  height: 90vh;
  height: 90svh; /* Safari */
  background: white;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  overflow: hidden;
}

.pdf-header {
  height: 50px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #f9fafb;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #111827;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-btn {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.page-indicator { font-size: 14px; font-variant-numeric: tabular-nums; }

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
}
.close-btn:hover { color: #111827; }

.pdf-body {
  flex: 1;
  background: #e5e7eb;
  overflow: auto;
  position: relative;
  display: flex;
  justify-content: center;
  padding: 24px;
}

.pdf-wrapper {
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: inline-block; /* Shrink to wrap canvas */
}

/* Ensure canvas is block so div wraps it exactly */
:deep(.vue-pdf-embed > canvas) {
    display: block;
}

.highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Let clicks pass through */
}

.highlight-rect {
  position: absolute;
  background: rgba(255, 230, 0, 0.3); /* Yellow highlight */
  border: 2px solid rgba(255, 200, 0, 0.8);
  box-shadow: 0 0 4px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
  animation: pulseHighlight 2s infinite;
}

@keyframes pulseHighlight {
    0% { background: rgba(255, 230, 0, 0.3); }
    50% { background: rgba(255, 230, 0, 0.5); }
    100% { background: rgba(255, 230, 0, 0.3); }
}

.highlight-label {
    position: absolute;
    top: -24px;
    left: 0;
    background: rgba(0,0,0,0.8);
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
}

.loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #6b7280;
}
.spinner {
    width: 24px; height: 24px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
