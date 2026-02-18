import { onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'

// Configure marked with custom renderer
const renderer = new marked.Renderer()

// Icons
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path></svg>`
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`

renderer.code = ({ text, lang }) => {
    const code = text
    const language = lang

    // Ensure code is a string to prevent "replace is not a function" error
    const validCode = typeof code === 'string' ? code : String(code || '')
    const validLang = !!(language && hljs.getLanguage(language))
    const highlighted = validLang
        ? hljs.highlight(validCode, { language }).value
        : hljs.highlightAuto(validCode).value

    // Improve label: Capitalize if possible, or use 'Code' if undefined
    const langLabel = language ? language.charAt(0).toUpperCase() + language.slice(1) : 'Code'
    const codeClass = language || 'plaintext'

    return `
<div class="code-wrapper">
    <div class="code-header">
        <span class="code-lang">${langLabel}</span>
        <button class="code-copy-btn" title="Copy code">
            ${COPY_ICON}
        </button>
    </div>
    <pre><code class="hljs language-${codeClass}">${highlighted}</code></pre>
</div>`
}

marked.setOptions({
    renderer,
    breaks: true,
    gfm: true
})

export function useMarkdown() {

    // Global click handler for copy buttons
    // Since this composable might be used in multiple places, we need to be careful not to add duplicate listeners repeatedly
    // A simple way is to check if we've already attached logic, or just attach/detach per component lifecycle.

    const handleCopyClick = async (e) => {
        const btn = e.target.closest('.code-copy-btn')
        if (!btn) return

        // Prevent race conditions if already copied
        if (btn.classList.contains('copied')) return

        // Find the code block content
        const wrapper = btn.closest('.code-wrapper')
        if (!wrapper) return

        const codeBlock = wrapper.querySelector('pre code')
        if (!codeBlock) return

        const text = codeBlock.innerText

        try {
            await navigator.clipboard.writeText(text)

            // Feedback: Change Icon to Checkmark
            btn.innerHTML = CHECK_ICON
            btn.classList.add('copied')

            setTimeout(() => {
                // Only revert if we are still in the copied state (simple check, though block above handles rapid clicks)
                if (btn.classList.contains('copied')) {
                    btn.innerHTML = COPY_ICON
                    btn.classList.remove('copied')
                }
            }, 2000)
        } catch (err) {
            console.error('Failed to copy code:', err)
        }
    }

    onMounted(() => {
        document.addEventListener('click', handleCopyClick)
    })

    onUnmounted(() => {
        document.removeEventListener('click', handleCopyClick)
    })

    const render = (content) => {
        if (!content) return ''
        let html = marked(content)
        // Strip any residual <cite>...</cite> tags if present
        html = html.replace(/<cite>[^<]*<\/cite>/g, '')
        return html
    }

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch (err) {
            console.error('Failed to copy:', err)
            return false
        }
    }

    return {
        render,
        copyToClipboard
    }
}

