<script setup>
import { onMounted } from 'vue'
import { useTheme, useLanguage } from '@/composables/useSettings'

const { init: initTheme } = useTheme()
const { init: initLang } = useLanguage()

onMounted(() => {
  initTheme()
  initLang()
})
</script>

<template>
  <router-view></router-view>
</template>


