import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import MainLayout from '../layouts/MainLayout.vue'
import ChatView from '../views/ChatView.vue'
import KnowledgeBaseView from '../views/KnowledgeBaseView.vue'
import AdminView from '../views/AdminView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth-callback',
      name: 'auth-callback',
      component: () => import('../views/AuthCallbackView.vue'),
      meta: { guest: true }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guest: true }
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home', // Default to Chat
          redirect: 'chat'
        },
        {
          path: 'chat',
          name: 'chat',
          component: ChatView
        },
        {
          path: 'knowledge-base',
          name: 'knowledge-base',
          component: KnowledgeBaseView
        },
        {
          path: 'admin',
          name: 'admin',
          component: AdminView,
          meta: { requiresAdmin: true }
        }
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' })
  } else if (to.meta.guest && authStore.isAuthenticated) {
    next({ name: 'home' })
  } else if (to.meta.requiresAdmin && authStore.user?.role !== 'SuperAdmin') {
    next({ name: 'home' }) // or specific 'access denied' page
  } else {
    next()
  }
})

export default router
