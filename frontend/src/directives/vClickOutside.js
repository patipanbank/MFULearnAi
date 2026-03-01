/**
 * v-click-outside directive
 *
 * Usage:
 *   <div v-click-outside="handleClose">...</div>
 *
 * Calls binding.value(event) when a click occurs outside `el`.
 */
export const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  }
}

export default vClickOutside
