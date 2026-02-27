<script setup>
import { ref, computed, onUnmounted } from 'vue'

let _idCounter = 0

const props = defineProps({
  /** Plain-text content — override with #content slot for rich HTML */
  content:    { type: String,  default: '' },
  placement:  { type: String,  default: 'top' },   // top | bottom | left | right
  showDelay:  { type: Number,  default: 200 },
  hideDelay:  { type: Number,  default: 100 },
  disabled:   { type: Boolean, default: false },
  maxWidth:   { type: String,  default: '240px' },
})

const tooltipId = `tooltip-${++_idCounter}`
const wrapperRef = ref(null)
const visible    = ref(false)
const coords     = ref({ top: 0, left: 0 })
let showTimer = null
let hideTimer = null

// ── Placement calculation ─────────────────────────────────────

const OFFSET = 8 // gap between trigger and popup (px)

function calcStyle(rect, placement) {
  const { innerWidth: vw, innerHeight: vh } = window
  let top, left, actualPlacement = placement

  // Auto-flip: keep inside viewport
  if (placement === 'top'    && rect.top    < 50)        actualPlacement = 'bottom'
  if (placement === 'bottom' && rect.bottom > vh - 50)   actualPlacement = 'top'
  if (placement === 'left'   && rect.left   < 120)       actualPlacement = 'right'
  if (placement === 'right'  && rect.right  > vw - 120)  actualPlacement = 'left'

  switch (actualPlacement) {
    case 'top':
      top  = rect.top  - OFFSET
      left = rect.left + rect.width / 2
      break
    case 'bottom':
      top  = rect.bottom + OFFSET
      left = rect.left   + rect.width / 2
      break
    case 'left':
      top  = rect.top  + rect.height / 2
      left = rect.left - OFFSET
      break
    case 'right':
      top  = rect.top    + rect.height / 2
      left = rect.right  + OFFSET
      break
  }

  return { top, left, actualPlacement }
}

const currentPlacement = ref(props.placement)

const popupStyle = computed(() => {
  const transform = {
    top:    'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left:   'translate(-100%, -50%)',
    right:  'translate(0, -50%)',
  }[currentPlacement.value] ?? 'translate(-50%, -100%)'

  return {
    top:      coords.value.top  + 'px',
    left:     coords.value.left + 'px',
    transform,
    '--tooltip-max-width': props.maxWidth,
  }
})

// ── Show / Hide ───────────────────────────────────────────────

function scheduleShow() {
  if (props.disabled || !props.content) return
  clearTimeout(hideTimer)
  showTimer = setTimeout(() => {
    if (!wrapperRef.value) return
    const rect = wrapperRef.value.getBoundingClientRect()
    const { top, left, actualPlacement } = calcStyle(rect, props.placement)
    coords.value = { top, left }
    currentPlacement.value = actualPlacement
    visible.value = true
  }, props.showDelay)
}

function scheduleHide() {
  clearTimeout(showTimer)
  hideTimer = setTimeout(() => { visible.value = false }, props.hideDelay)
}

function onKeydown(e) {
  if (e.key === 'Escape') { visible.value = false }
}

// Reposition on scroll/resize while open
function onScroll() {
  if (!visible.value || !wrapperRef.value) return
  const rect = wrapperRef.value.getBoundingClientRect()
  const { top, left, actualPlacement } = calcStyle(rect, props.placement)
  coords.value = { top, left }
  currentPlacement.value = actualPlacement
}

window.addEventListener('scroll', onScroll, { passive: true, capture: true })
window.addEventListener('resize', onScroll, { passive: true })

onUnmounted(() => {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  window.removeEventListener('scroll', onScroll, { capture: true })
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="tooltip-wrapper"
    :aria-describedby="visible ? tooltipId : undefined"
    @mouseenter="scheduleShow"
    @mouseleave="scheduleHide"
    @focusin="scheduleShow"
    @focusout="scheduleHide"
    @keydown="onKeydown"
  >
    <slot />

    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div
          v-if="visible && (content || $slots.content)"
          :id="tooltipId"
          class="tooltip-popup"
          :class="`tooltip-popup--${currentPlacement}`"
          :style="popupStyle"
          role="tooltip"
        >
          <slot name="content">{{ content }}</slot>
          <span class="tooltip-arrow" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.tooltip-wrapper {
  display: contents; /* renders children as if wrapper doesn't exist */
}
</style>
