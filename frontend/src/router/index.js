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
            path: '/auth/callback',
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
                    path: 'dashboard',
                    name: 'Dashboard',
                    component: () => import('../views/admin/AdminDashboard.vue'),
                    meta: { requiresRole: 'superadmin' }
                },
                {
                    path: 'dashboard/prompts',
                    name: 'AdminPrompts',
                    component: () => import('../views/admin/AdminCorePrompts.vue'),
                    meta: { requiresRole: 'superadmin' }
                },
                {
                    path: 'dashboard/departments',
                    name: 'AdminDepartments',
                    component: () => import('../views/admin/AdminDepartments.vue'),
                    meta: { requiresRole: 'superadmin' }
                },
                {
                    path: 'dashboard/users',
                    name: 'AdminUsers',
                    component: () => import('../views/admin/AdminUsers.vue'),
                    meta: { requiresRole: 'superadmin' }
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

    // Retrieve user role from localStorage
    let userRole = 'guest'
    try {
        const storedUser = localStorage.getItem('user_info')
        if (storedUser) {
            const user = JSON.parse(storedUser)
            userRole = user.role || 'guest'
        }
    } catch (e) {
        console.error('Error parsing user info', e)
    }

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login')
    } else if (to.meta.requiresGuest && isAuthenticated) {
        next('/chat')
    } else if (to.meta.requiresRole && to.meta.requiresRole !== userRole) {
        next('/chat')
    } else {
        next()
    }
})

export default router
