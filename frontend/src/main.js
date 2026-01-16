import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import CoreuiVue from '@coreui/vue'
import '@coreui/coreui/dist/css/coreui.min.css'

const app = createApp(App)
app.use(router)
app.use(CoreuiVue)
app.mount('#app')
