import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import CoreuiVue from '@coreui/vue'

// ── Styles (order matters: reset → framework → design tokens → shared → code blocks) ──
import '@coreui/coreui/dist/css/coreui.min.css'
import './styles/main.css'
import './styles/shared.css'
import './styles/code-block.css'
import 'highlight.js/styles/atom-one-dark.css'

// ── Directives ──
import { vTooltip } from '@/directives/vTooltip'
import { vClickOutside } from '@/directives/vClickOutside'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(CoreuiVue)
app.directive('click-outside', vClickOutside)
app.directive('tooltip', vTooltip)

// Initialize auth store
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()
authStore.init()

app.mount('#app')
