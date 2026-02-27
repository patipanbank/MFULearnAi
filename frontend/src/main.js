import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import CoreuiVue from '@coreui/vue'
import '@coreui/coreui/dist/css/coreui.min.css'
import './styles/main.css'
import './styles/code-block.css'
import 'highlight.js/styles/atom-one-dark.css'
import { vTooltip } from '@/directives/vTooltip'

// Click outside directive
const clickOutside = {
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

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(CoreuiVue)
app.directive('click-outside', clickOutside)
app.directive('tooltip', vTooltip)

// Initialize auth store
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()
authStore.init()

app.mount('#app')
