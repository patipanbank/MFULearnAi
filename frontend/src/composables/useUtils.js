import { ref, computed, watch, nextTick } from 'vue'

export function useScrollToBottom(containerRef) {
    const scrollToBottom = async (smooth = true) => {
        await nextTick()
        if (containerRef.value) {
            containerRef.value.scrollTo({
                top: containerRef.value.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            })
        }
    }

    return { scrollToBottom }
}

export function useAutoResize(textareaRef, maxHeight = 150) {
    const resize = () => {
        const el = textareaRef.value
        if (!el) return

        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
    }

    return { resize }
}
