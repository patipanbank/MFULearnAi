<script setup>
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center bg-slate-900 text-slate-300 p-8">
    <router-link to="/knowledge" class="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
      <ArrowLeftIcon class="w-5 h-5" />
      <span>Back to Knowledge</span>
    </router-link>
    <h1 class="text-2xl font-bold text-white">Collection View</h1>
    <p class="mt-2 text-slate-500">This view is being updated.</p>
  </div>
</template>

<style scoped>
/* Force Heroicons SVG to respect dimensions */
:deep(svg) {
  width: inherit;
  height: inherit;
  max-width: 100%;
  max-height: 100%;
  flex-shrink: 0;
}
</style>
