<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

const { dialogState, closeDialog } = useConfirmDialog()

const modalRef = ref(null)

// ── Derived state ──
const isConfirm = computed(() => dialogState.type === 'confirm')

const title = computed(() => {
  if (dialogState.title) return dialogState.title
  if (dialogState.type === 'alert') {
    const v = dialogState.variant
    if (v === 'error' || v === 'danger') return 'เกิดข้อผิดพลาด'
    if (v === 'success') return 'สำเร็จ'
    if (v === 'warning') return 'คำเตือน'
    return 'แจ้งเตือน'
  }
  return 'ยืนยัน'
})

const confirmText = computed(() => dialogState.confirmLabel || (isConfirm.value ? 'ยืนยัน' : 'ตกลง'))
const cancelText = computed(() => dialogState.cancelLabel || 'ยกเลิก')

const variantClass = computed(() => dialogState.variant || 'danger')

// ── Actions ──
const handleConfirm = () => closeDialog(true)
const handleCancel = () => closeDialog(false)

// ── Keyboard ──
const handleKeydown = (e) => {
  if (!dialogState.visible) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    handleCancel()
  } else if (e.key === 'Enter') {
    const tag = e.target?.tagName?.toLowerCase()
    if (tag !== 'button') {
      e.preventDefault()
      e.stopPropagation()
      handleConfirm()
    }
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown, true))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown, true))

// ── Auto-focus ──
watch(() => dialogState.visible, async (visible) => {
  if (visible) {
    await nextTick()
    // Focus the confirm/ok button when dialog opens
    const btn = modalRef.value?.querySelector('.btn-confirm')
    btn?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="dialogState.visible" class="dialog-overlay" @click.self="handleCancel">
        <div ref="modalRef" class="dialog-card" role="alertdialog" aria-modal="true">
          <!-- Icon -->
          <div class="dialog-icon" :class="variantClass">
            <!-- Danger / Error -->
            <svg v-if="variantClass === 'danger' || variantClass === 'error'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <!-- Warning -->
            <svg v-else-if="variantClass === 'warning'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <!-- Success -->
            <svg v-else-if="variantClass === 'success'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <!-- Info (default) -->
            <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </div>

          <!-- Title -->
          <h3 class="dialog-title">{{ title }}</h3>

          <!-- Message -->
          <p class="dialog-message">{{ dialogState.message }}</p>

          <!-- Actions -->
          <div class="dialog-actions" :class="{ 'single': !isConfirm }">
            <button v-if="isConfirm" class="btn-cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="btn-confirm" :class="variantClass" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ── */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Card ── */
.dialog-card {
  background: var(--color-bg-primary, #1a1a1a);
  border: 1px solid var(--color-border, #333);
  border-radius: 16px;
  padding: 28px 24px 20px;
  width: 90%;
  max-width: 360px;
  box-shadow:
    0 20px 60px -12px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  text-align: center;
}

/* ── Icon ── */
.dialog-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.dialog-icon.danger,
.dialog-icon.error {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.dialog-icon.warning {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.dialog-icon.success {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.dialog-icon.info {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

/* ── Title ── */
.dialog-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary, #fff);
  margin: 0 0 8px;
}

/* ── Message ── */
.dialog-message {
  font-size: 14px;
  color: var(--color-text-secondary, #aaa);
  margin: 0 0 24px;
  line-height: 1.6;
  word-break: break-word;
}

/* ── Actions ── */
.dialog-actions {
  display: flex;
  gap: 10px;
}

.dialog-actions.single {
  justify-content: center;
}

.dialog-actions button {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

/* Cancel */
.btn-cancel {
  background: var(--color-bg-secondary, #2a2a2a);
  color: var(--color-text-primary, #fff);
  border: 1px solid var(--color-border, #444) !important;
}

.btn-cancel:hover {
  background: var(--color-bg-hover, #333);
}

/* Confirm */
.btn-confirm {
  color: white;
}

.btn-confirm.danger,
.btn-confirm.error {
  background: #ef4444;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.btn-confirm.danger:hover,
.btn-confirm.error:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.btn-confirm.warning {
  background: #f59e0b;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.btn-confirm.warning:hover {
  background: #d97706;
  transform: translateY(-1px);
}

.btn-confirm.success {
  background: #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-confirm.success:hover {
  background: #059669;
  transform: translateY(-1px);
}

.btn-confirm.info {
  background: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.btn-confirm.info:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

/* ── Transition ── */
.dialog-fade-enter-active {
  animation: dialogIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-fade-leave-active {
  animation: dialogOut 0.15s ease-in;
}

@keyframes dialogIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialogOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.dialog-fade-enter-active .dialog-card {
  animation: cardIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-fade-leave-active .dialog-card {
  animation: cardOut 0.15s ease-in;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes cardOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .dialog-card {
    max-width: 92%;
    padding: 24px 16px 16px;
  }
}
</style>
