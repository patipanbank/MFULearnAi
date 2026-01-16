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
            component: () => import('../views/Login.vue')
        },
        {
            path: '/chat',
            name: 'Chat',
            component: () => import('../views/Chat.vue'),
            // Add validation here later to check localStorage for auth token
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

export default router
