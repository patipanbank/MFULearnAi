<script setup>
import { BookOpenIcon, BeakerIcon } from '@heroicons/vue/24/outline'
</script>

<template>
  <div class="h-full w-full flex flex-col items-center justify-center bg-slate-900/50 text-slate-300 p-8 text-center">
    
    <div class="max-w-md w-full bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <div class="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-6 ring-1 ring-white/5">
            <BookOpenIcon class="w-8 h-8 text-blue-400" />
        </div>
        
        <h2 class="text-xl font-semibold text-white mb-2">Knowledge Base</h2>
        <p class="text-sm text-slate-400 leading-relaxed mb-6">
            We're building a new way to manage your AI's intelligence. 
            Check back soon for document uploads and collection management.
        </p>
        
        <div class="flex items-center justify-center gap-2 py-2 px-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <BeakerIcon class="w-4 h-4 text-blue-400" />
            <span class="text-xs font-medium text-blue-300">Work in Progress</span>
        </div>
    </div>

  </div>
</template>
