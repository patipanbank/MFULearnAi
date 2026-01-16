<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
        <h1 class="text-xl font-bold text-gray-900">MFULearnAi</h1>
        <nav class="space-x-4">
          <RouterLink to="/" class="text-gray-700 hover:text-gray-900">Home</RouterLink>
          <RouterLink to="/about" class="text-gray-700 hover:text-gray-900">About</RouterLink>
        </nav>
      </div>
    </header>

    <main>
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
