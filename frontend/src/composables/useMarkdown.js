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

        // R5: Stateless Citation Parsing (Strict Architecture)
        // Convert <cite>ID</cite> -> <span class="citation-token" data-citation-id="ID"></span>
        // We DO NOT map to numbers here. ChatMessage.vue handles indexing.
        const CITE_REGEX = /<cite>([^<]+)<\/cite>/g
        html = html.replace(CITE_REGEX, (_, id) => {
            return `<span class="citation-token" data-citation-id="${id}"></span>`
        })

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
