<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useHelp } from '@/composables/useHelp'

defineProps({
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const { helpContent } = useHelp()

// Close on Escape
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
onMounted(() => document.addEventListener('keydown', handleKeydown, true))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown, true))
</script>

<template>
  <Teleport to="body">
    <Transition name="help-fade">
      <div v-if="show" class="help-overlay" @click.self="emit('close')" role="dialog" aria-modal="true" :aria-label="helpContent.title">
        <div class="help-panel">

          <!-- Header -->
          <div class="help-header">
            <div class="help-header-left">
              <span class="help-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              <h2 class="help-title">{{ helpContent.title }}</h2>
            </div>
            <button class="help-close-btn" @click="emit('close')" aria-label="Close help">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="help-body">
            <div
              v-for="(section, si) in helpContent.sections"
              :key="si"
              class="help-section"
            >
              <h3 class="help-section-heading">{{ section.heading }}</h3>
              <ul class="help-item-list">
                <li v-for="(item, ii) in section.items" :key="ii" class="help-item">
                  <span class="help-bullet">›</span>
                  <span class="help-item-text">{{ item.text }}</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────── */
.help-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 70px 18px 0 0;
  pointer-events: none;
}

/* ── Panel ───────────────────────────────────────────────────── */
.help-panel {
  pointer-events: all;
  width: 340px;
  max-height: calc(100vh - 90px);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────── */
.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.help-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.help-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-bg-tertiary);
  color: var(--color-accent, #6366f1);
  flex-shrink: 0;
}

.help-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.3;
}

.help-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.help-close-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* ── Body ────────────────────────────────────────────────────── */
.help-body {
  overflow-y: auto;
  padding: 16px 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.help-body::-webkit-scrollbar { width: 5px; }
.help-body::-webkit-scrollbar-track { background: transparent; }
.help-body::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }

/* ── Section ─────────────────────────────────────────────────── */
.help-section-heading {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-accent, #6366f1);
  margin: 0 0 10px;
}

/* ── Items ───────────────────────────────────────────────────── */
.help-item-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.help-bullet {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-accent, #6366f1);
  line-height: 1.6;
  flex-shrink: 0;
}

.help-item-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

/* ── Transition ──────────────────────────────────────────────── */
.help-fade-enter-active,
.help-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.help-fade-enter-from,
.help-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

/* ── Mobile ──────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .help-overlay {
    align-items: flex-end;
    justify-content: stretch;
    padding: 0;
  }
  .help-panel {
    width: 100%;
    max-height: 70vh;
    border-radius: 20px 20px 0 0;
    border-bottom: none;
  }
}
</style>
