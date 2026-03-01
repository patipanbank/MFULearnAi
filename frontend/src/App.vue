<script setup>
import { onMounted } from 'vue'
import { useTheme, useLanguage } from '@/composables/useSettings'
import GlobalConfirmDialog from '@/components/common/GlobalConfirmDialog.vue'
import AppToast from '@/components/common/AppToast.vue'

const { init: initTheme } = useTheme()
const { init: initLang } = useLanguage()

onMounted(() => {
  initTheme()
  initLang()
})
</script>

<template>
  <router-view />
  <GlobalConfirmDialog />
  <AppToast />
</template>

<style>
/* Global resets or variables can go here, 
   but CoreUI should handle most styling */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
</style>
