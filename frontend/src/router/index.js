import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            redirect: '/login'
        },
        {
            path: '/login',
            name: 'Login',
            component: () => import('../views/Login.vue'),
            meta: { requiresGuest: true }
        },
        {
            path: '/chat',
            name: 'Chat',
            component: () => import('../views/Chat.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/auth-callback',
            name: 'AuthCallback',
            component: () => import('../views/AuthCallback.vue')
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/login'
        }
    ]
})

// Navigation guards
router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('auth_token')
    const isAuthenticated = !!token

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login')
    } else if (to.meta.requiresGuest && isAuthenticated) {
        next('/chat')
    } else {
        next()
    }
})

export default router
