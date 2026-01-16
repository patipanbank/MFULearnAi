import 'core-js/stable'
import Vue from 'vue'
import CoreuiVuePro from '@coreui/vue-pro'
// import CoreuiVuePro from '../node_modules/@coreui/vue-pro/src/index.js'
// import CoreuiVue from '@coreui/vue'
import App from './App'
import router from './router/index'
import { iconsSet as icons } from './assets/icons/icons.js'
import i18n from './i18n.js'
import store from "@/store/store";

import OtpInput from "@bachdgvn/vue-otp-input";
Vue.component("v-otp-input", OtpInput);

Vue.use(CoreuiVuePro)
Vue.prototype.$log = console.log.bind(console)

import VueQRCodeComponent from 'vue-qrcode-component'
Vue.component('qr-code', VueQRCodeComponent)

import moment from 'moment'
Vue.prototype.moment = moment


import GAuth from 'vue-google-oauth2'
const gauthOption = {
    clientId: process.env.VUE_APP_CLIENTID,
    scope: process.env.VUE_APP_SCOPE,
    prompt: process.env.VUE_APP_PROMPT
}
Vue.use(GAuth, gauthOption)
console.log(gauthOption)

new Vue({
  el: '#app',
  router,
  store,
  //CIcon component documentation: https://coreui.io/vue/docs/components/icon
  icons,
  i18n,
  template: '<App/>',
  components: {
    App
  }
})
