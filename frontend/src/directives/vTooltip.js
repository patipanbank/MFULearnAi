/**
 * v-tooltip directive
 *
 * Usage:
 *   v-tooltip="'Save'"
 *   v-tooltip="{ content: 'Delete', placement: 'bottom' }"
 */

const OFFSET  = 8
const Z_INDEX = 9999
let _uid = 0

function getOptions(binding) {
  if (typeof binding.value === 'string') {
    return { content: binding.value, placement: 'top', showDelay: 200, hideDelay: 100 }
  }
  return {
    content:   binding.value?.content   ?? '',
    placement: binding.value?.placement ?? 'top',
    showDelay: binding.value?.showDelay ?? 200,
    hideDelay: binding.value?.hideDelay ?? 100,
    disabled:  binding.value?.disabled  ?? false,
  }
}

function calcPos(triggerRect, placement) {
  const { innerWidth: vw, innerHeight: vh } = window
  let p = placement

  if (p === 'top'    && triggerRect.top    < 50)       p = 'bottom'
  if (p === 'bottom' && triggerRect.bottom > vh - 50)  p = 'top'
  if (p === 'left'   && triggerRect.left   < 120)      p = 'right'
  if (p === 'right'  && triggerRect.right  > vw - 120) p = 'left'

  let top, left
  switch (p) {
    case 'top':
      top  = triggerRect.top   - OFFSET
      left = triggerRect.left  + triggerRect.width / 2
      break
    case 'bottom':
      top  = triggerRect.bottom + OFFSET
      left = triggerRect.left   + triggerRect.width / 2
      break
    case 'left':
      top  = triggerRect.top  + triggerRect.height / 2
      left = triggerRect.left - OFFSET
      break
    case 'right':
      top  = triggerRect.top   + triggerRect.height / 2
      left = triggerRect.right + OFFSET
      break
  }

  return { top, left, placement: p }
}

const transformMap = {
  top:    'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left:   'translate(-100%, -50%)',
  right:  'translate(0, -50%)',
}

function createPopup(id) {
  const el = document.createElement('div')
  el.id = `v-tooltip-${id}`
  el.setAttribute('role', 'tooltip')

  const arrow = document.createElement('span')
  arrow.className = 'tooltip-arrow'
  el.appendChild(arrow)

  return el
}

function applyPos(popup, triggerRect, placement) {
  const { top, left, placement: p } = calcPos(triggerRect, placement)
  popup.style.top       = top  + 'px'
  popup.style.left      = left + 'px'
  popup.style.transform = transformMap[p] ?? transformMap.top
  popup.className = `tooltip-popup tooltip-popup--${p}`
}

function show(el) {
  const ctx = el._vTooltip
  if (!ctx || ctx.disabled || !ctx.content) return
  clearTimeout(ctx.hideTimer)

  ctx.showTimer = setTimeout(() => {
    if (!ctx.popup.isConnected) {
      ctx.popup.textContent = ctx.content
      ctx.popup.appendChild(ctx.arrow)
      document.body.appendChild(ctx.popup)

      // fade in
      ctx.popup.style.opacity   = '0'
      ctx.popup.style.transform = 'scale(0.95)'
      requestAnimationFrame(() => {
        ctx.popup.style.transition = 'opacity 0.15s ease, transform 0.15s ease'
        ctx.popup.style.opacity    = '1'
        applyPos(ctx.popup, el.getBoundingClientRect(), ctx.placement)
      })
    }
  }, ctx.showDelay)
}

function hide(el) {
  const ctx = el._vTooltip
  if (!ctx) return
  clearTimeout(ctx.showTimer)

  ctx.hideTimer = setTimeout(() => {
    if (ctx.popup.isConnected) {
      ctx.popup.style.opacity   = '0'
      ctx.popup.style.transform = 'scale(0.95)'
      setTimeout(() => ctx.popup.remove(), 150)
    }
  }, ctx.hideDelay)
}

function onScroll(el) {
  const ctx = el._vTooltip
  if (!ctx || !ctx.popup.isConnected) return
  applyPos(ctx.popup, el.getBoundingClientRect(), ctx.placement)
}

export const vTooltip = {
  mounted(el, binding) {
    const opts  = getOptions(binding)
    const uid   = ++_uid
    const popup = createPopup(uid)
    const arrow = popup.querySelector('.tooltip-arrow')

    // base popup styles (global CSS handles .tooltip-popup, but set z-index explicitly)
    popup.style.position = 'fixed'
    popup.style.zIndex   = Z_INDEX

    const ctx = {
      ...opts,
      popup,
      arrow,
      showTimer: null,
      hideTimer: null,
      scrollListener: () => onScroll(el),
    }
    el._vTooltip = ctx
    el.setAttribute('aria-describedby', popup.id)

    el._tooltipShow  = () => show(el)
    el._tooltipHide  = () => hide(el)
    el._tooltipKey   = (e) => { if (e.key === 'Escape') hide(el) }

    el.addEventListener('mouseenter', el._tooltipShow)
    el.addEventListener('mouseleave', el._tooltipHide)
    el.addEventListener('focusin',    el._tooltipShow)
    el.addEventListener('focusout',   el._tooltipHide)
    el.addEventListener('keydown',    el._tooltipKey)
    window.addEventListener('scroll', ctx.scrollListener, { passive: true, capture: true })
    window.addEventListener('resize', ctx.scrollListener, { passive: true })
  },

  updated(el, binding) {
    const opts = getOptions(binding)
    Object.assign(el._vTooltip, opts)
  },

  unmounted(el) {
    const ctx = el._vTooltip
    if (!ctx) return

    clearTimeout(ctx.showTimer)
    clearTimeout(ctx.hideTimer)
    ctx.popup.remove()
    window.removeEventListener('scroll', ctx.scrollListener, { capture: true })
    window.removeEventListener('resize', ctx.scrollListener)
    el.removeEventListener('mouseenter', el._tooltipShow)
    el.removeEventListener('mouseleave', el._tooltipHide)
    el.removeEventListener('focusin',    el._tooltipShow)
    el.removeEventListener('focusout',   el._tooltipHide)
    el.removeEventListener('keydown',    el._tooltipKey)
    delete el._vTooltip
  },
}

export default vTooltip
