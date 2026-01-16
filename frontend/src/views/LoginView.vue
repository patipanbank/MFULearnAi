<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { LogIn } from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const isAdminLogin = ref(false)
const adminEmail = ref('')
const adminPassword = ref('')

const handleSamlLogin = () => {
  // In production, this would redirect to backend SAML endpoint
  // window.location.href = '/api/auth/login/saml'
  authStore.loginMock('Student')
  router.push('/')
}

const handleGoogleLogin = () => {
  // window.location.href = '/api/auth/login/google'
  authStore.loginMock('Staff')
  router.push('/')
}

const handleAdminLogin = () => {
  // API Call to /api/auth/admin/login
  authStore.loginMock('SuperAdmin')
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
    <!-- Background Decoration -->
    <div class="absolute inset-0 z-0">
      <div class="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div class="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-8 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
    </div>

    <div class="relative z-10 w-full max-w-md p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 mb-4 shadow-lg">
          <LogIn class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          MFULearnAi
        </h1>
        <p class="text-gray-500 mt-2">Welcome back! Please login to continue.</p>
      </div>

      <div v-if="!isAdminLogin" class="space-y-4">
        <button 
          @click="handleSamlLogin"
          class="w-full flex items-center justify-center gap-3 px-6 py-3 text-white bg-red-800 hover:bg-red-900 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg font-medium group"
        >
          <img src="https://reg.mfu.ac.th/registrar/images/logo_mfu.png" class="w-6 h-6 object-contain bg-white rounded-full p-0.5" alt="MFU">
          Login with MFU Identity
        </button>

        <button 
          @click="handleGoogleLogin"
          class="w-full flex items-center justify-center gap-3 px-6 py-3 text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md font-medium"
        >
          <img src="https://www.google.com/favicon.ico" class="w-5 h-5" alt="Google">
          Login with Google
        </button>

        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <button 
          @click="isAdminLogin = true"
          class="w-full text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
        >
          Admin Login
        </button>
      </div>

      <div v-else class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input 
            v-model="adminEmail"
            type="email" 
            class="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="admin@example.com"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input 
            v-model="adminPassword"
            type="password" 
            class="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="••••••••"
          >
        </div>

        <button 
          @click="handleAdminLogin"
          class="w-full py-3 text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
        >
          Sign In
        </button>

        <button 
          @click="isAdminLogin = false"
          class="w-full text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
        >
          Back to Social Login
        </button>
      </div>

      <div class="mt-8 text-center text-xs text-gray-400">
        &copy; 2024 Mae Fah Luang University. All rights reserved.
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
</style>
