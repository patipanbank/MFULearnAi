<script setup>
import { BookOpenIcon } from '@heroicons/vue/24/outline'
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center bg-slate-900 text-slate-300 p-8 text-center">
    <div class="p-6 bg-slate-800 rounded-full mb-6">
      <BookOpenIcon class="w-16 h-16 text-blue-500" />
    </div>
    <h1 class="text-3xl font-bold text-white mb-4">Knowledge Base</h1>
    <p class="max-w-md text-lg text-slate-400 mb-8">
      We are redesigning the knowledge management experience. 
      This module is currently under construction.
    </p>
    <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
      <p class="text-sm font-mono text-blue-400">Status: Redevelopment in progress</p>
    </div>
  </div>
</template>
