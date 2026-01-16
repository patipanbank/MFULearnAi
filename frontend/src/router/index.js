import Vue from 'vue'
import Router from 'vue-router'

// Containers
const TheContainer = () => import('@/containers/TheContainer')
const TheContainer_Landing = () => import('@/containers/TheContainer_Landing.vue')
const TheContainer_Project = () => import('@/containers/TheContainer_Project')


// Views
const Dashboard = () => import('@/views/Dashboard')
const Chat = () => import('@/views/chat/Chat')
const KnowledgeBase = () => import('@/views/knowledge/KnowledgeBase')

import Login from '@/views/pages/Login'
// const Login = () => import('@/projects/views/Login.vue')

// ... (other imports)

Vue.use(Router)

export default new Router({
    mode: 'history', // https://router.vuejs.org/api/#mode
    linkActiveClass: 'open active',
    scrollBehavior: () => ({ y: 0 }),
    routes: [

        {
            path: '/',
            redirect: '/chat',
            name: 'Home',
            component: TheContainer,
            children: [
                {
                    path: 'chat',
                    name: 'Chat',
                    component: Chat
                },
                {
                    path: 'knowledge',
                    name: 'Knowledge Base',
                    component: KnowledgeBase
                },
                {
                    path: 'dashboard',
                    name: 'Dashboard',
                    component: Dashboard,
                    beforeEnter: (to, from, next) => {
                        try {
                            const userStr = localStorage.getItem('user');
                            const user = userStr ? JSON.parse(userStr) : {};
                            if (user.role === 'SuperAdmin') {
                                next();
                            } else {
                                next('/chat');
                            }
                        } catch (e) {
                            next('/chat');
                        }
                    }
                }
            ]
        },

        {
            path: '/pages',
            redirect: '/pages/404',
            name: 'Pages',
            component: {
                render(c) {
                    return c('router-view')
                }
            },
            children: [
                {
                    path: '404',
                    name: 'Page404',
                    component: Page404
                },
                {
                    path: 'login',
                    name: 'Login',
                    component: Login
                }
            ]
        }
    ]
})
