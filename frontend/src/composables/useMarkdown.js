import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'

// Configure marked once
marked.setOptions({
    highlight: (code, lang) => {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value
        }
        return hljs.highlightAuto(code).value
    },
    breaks: true,
    gfm: true
})

export function useMarkdown() {
    const render = (content) => {
        if (!content) return ''
        let html = marked(content)

        // Strip any residual <cite>...</cite> tags from AI responses (no longer used)
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
