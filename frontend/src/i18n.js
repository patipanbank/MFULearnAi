import Vue from 'vue'
import VueI18n from 'vue-i18n'

import en from './store/lang/en'
import th from './store/lang/th'

Vue.use(VueI18n)
//
const messages = {
  en: en,
  th: th
}

export default new VueI18n({
  locale: getBrowserLocale(),
  fallbackLocale: 'th',
  messages,
})

function getBrowserLocale() {
  const navigatorLocale =
    navigator.languages !== undefined ?
    navigator.languages[0] :
    navigator.language

  if (!navigatorLocale) {
    return undefined
  }

  return navigatorLocale.trim().split(/-|_/)[0]
}
