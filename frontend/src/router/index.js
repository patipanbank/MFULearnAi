import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'Login',
            component: () => import('../views/Login.vue'),
            meta: { requiresGuest: true }
        },
        {
            path: '/auth-callback',
            name: 'AuthCallback',
            component: () => import('../views/AuthCallback.vue')
        },
        {
            path: '/',
            component: () => import('../layouts/ChatLayout.vue'),
            meta: { requiresAuth: true },
            children: [
                {
                    path: '',
                    redirect: '/chat'
                },
                {
                    path: 'chat',
                    name: 'Chat',
                    component: () => import('../views/Chat.vue')
                },
                {
                    path: 'knowledge',
                    name: 'Knowledge',
                    component: () => import('../views/knowledge/KnowledgeDashboard.vue')
                },
                {
                    path: 'admin',
                    name: 'Admin',
                    component: () => import('../views/admin/AdminDashboard.vue')
                },
                {
                    path: 'admin/prompts',
                    name: 'AdminPrompts',
                    component: () => import('../views/admin/AdminCorePrompts.vue')
                },
                {
                    path: 'admin/departments',
                    name: 'AdminDepartments',
                    component: () => import('../views/admin/AdminDepartments.vue')
                },
                {
                    path: 'admin/users',
                    name: 'AdminUsers',
                    component: () => import('../views/admin/AdminUsers.vue')
                }
            ]
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
