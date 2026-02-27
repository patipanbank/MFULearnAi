/**
 * useTooltip — programmatic tooltip control
 *
 * @param {Ref<HTMLElement|null>} targetRef  - the element the tooltip is anchored to
 * @param {Object} options
 * @param {string}  options.content
 * @param {string}  options.placement  top | bottom | left | right
 * @param {number}  options.showDelay  ms
 * @param {number}  options.hideDelay  ms
 *
 * @example
 *   const btnRef = ref(null)
 *   const { show, hide } = useTooltip(btnRef, { content: 'Copied!' })
 *   // after clipboard copy:
 *   show(); setTimeout(hide, 1500)
 */

import { ref, onUnmounted } from 'vue'

let _uid = 0
const OFFSET = 8

const transformMap = {
  top:    'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left:   'translate(-100%, -50%)',
  right:  'translate(0, -50%)',
}

function calcPos(rect, placement) {
  const { innerWidth: vw, innerHeight: vh } = window
  let p = placement

  if (p === 'top'    && rect.top    < 50)       p = 'bottom'
  if (p === 'bottom' && rect.bottom > vh - 50)  p = 'top'
  if (p === 'left'   && rect.left   < 120)      p = 'right'
  if (p === 'right'  && rect.right  > vw - 120) p = 'left'

  let top, left
  switch (p) {
    case 'top':    top = rect.top - OFFSET;    left = rect.left + rect.width / 2; break
    case 'bottom': top = rect.bottom + OFFSET; left = rect.left + rect.width / 2; break
    case 'left':   top = rect.top + rect.height / 2;  left = rect.left - OFFSET; break
    case 'right':  top = rect.top + rect.height / 2;  left = rect.right + OFFSET; break
  }
  return { top, left, placement: p }
}

export function useTooltip(targetRef, options = {}) {
  const isVisible = ref(false)
  const uid = ++_uid

  const popup = document.createElement('div')
  popup.id = `prog-tooltip-${uid}`
  popup.setAttribute('role', 'tooltip')
  popup.style.position  = 'fixed'
  popup.style.zIndex    = '9999'
  popup.style.transition = 'opacity 0.15s ease, transform 0.15s ease'

  const arrow = document.createElement('span')
  arrow.className = 'tooltip-arrow'
  popup.appendChild(arrow)

  let current = {
    content:   options.content   ?? '',
    placement: options.placement ?? 'top',
    showDelay: options.showDelay ?? 200,
    hideDelay: options.hideDelay ?? 100,
  }

  let showTimer = null
  let hideTimer = null

  function applyStyle() {
    if (!targetRef.value) return
    const { top, left, placement: p } = calcPos(
      targetRef.value.getBoundingClientRect(),
      current.placement
    )
    popup.style.top       = top  + 'px'
    popup.style.left      = left + 'px'
    popup.style.transform = transformMap[p] ?? transformMap.top
    popup.className = `tooltip-popup tooltip-popup--${p}`
  }

  function show(overrideContent) {
    clearTimeout(hideTimer)
    if (overrideContent) current.content = overrideContent

    showTimer = setTimeout(() => {
      if (!popup.isConnected) {
        // set text (preserve arrow child)
        popup.childNodes.forEach(n => { if (n !== arrow) n.remove() })
        popup.insertBefore(document.createTextNode(current.content), arrow)
        document.body.appendChild(popup)
        popup.style.opacity = '0'
        requestAnimationFrame(() => {
          applyStyle()
          popup.style.opacity = '1'
        })
      }
      isVisible.value = true
    }, current.showDelay)
  }

  function hide() {
    clearTimeout(showTimer)
    hideTimer = setTimeout(() => {
      popup.style.opacity = '0'
      setTimeout(() => { popup.remove(); isVisible.value = false }, 150)
    }, current.hideDelay)
  }

  function toggle(overrideContent) {
    isVisible.value ? hide() : show(overrideContent)
  }

  function update(newOptions = {}) {
    Object.assign(current, newOptions)
  }

  const scrollHandler = () => { if (popup.isConnected) applyStyle() }
  window.addEventListener('scroll', scrollHandler, { passive: true, capture: true })
  window.addEventListener('resize', scrollHandler, { passive: true })

  onUnmounted(() => {
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
    popup.remove()
    window.removeEventListener('scroll', scrollHandler, { capture: true })
    window.removeEventListener('resize', scrollHandler)
  })

  return { show, hide, toggle, update, isVisible }
}

export default useTooltip
