import { ref, computed, watch, nextTick } from 'vue'

export function useScrollToBottom(containerRef) {
    // Flag to distinguish programmatic scroll from user scroll.
    // This prevents handleScroll from falsely marking isUserScrolledUp = true
    // when we programmatically scroll during streaming.
    const isProgrammaticScroll = ref(false)

    const scrollToBottom = async (smooth = true) => {
        await nextTick()
        if (containerRef.value) {
            isProgrammaticScroll.value = true
            containerRef.value.scrollTo({
                top: containerRef.value.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            })
            // Clear flag after scroll settles (smooth scroll takes time)
            // Use a timeout slightly longer than a frame to cover instant + smooth
            setTimeout(() => {
                isProgrammaticScroll.value = false
            }, smooth ? 300 : 50)
        }
    }

    return { scrollToBottom, isProgrammaticScroll }
}

/**
 * Simple throttle: calls fn at most once per `delay` ms.
 * Returns a wrapper function.
 */
export function useThrottleFn(fn, delay = 80) {
    let lastCall = 0
    let timer = null
    const throttled = (...args) => {
        const now = Date.now()
        const remaining = delay - (now - lastCall)
        if (remaining <= 0) {
            lastCall = now
            fn(...args)
        } else if (!timer) {
            timer = setTimeout(() => {
                lastCall = Date.now()
                timer = null
                fn(...args)
            }, remaining)
        }
    }
    throttled.cancel = () => {
        if (timer) { clearTimeout(timer); timer = null }
    }
    return throttled
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
