import Vue from 'vue'
import Router from 'vue-router'

// Containers
const TheContainer = () => import('@/containers/TheContainer')
const TheContainer_Landing = () => import('@/containers/TheContainer_Landing.vue')
const TheContainer_Project = () => import('@/containers/TheContainer_Project')


// Views
const Dashboard = () => import('@/views/Dashboard')
const Chat = () => import('@/views/chat/Chat')

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
                    path: 'dashboard',
                    name: 'Dashboard',
                    component: Dashboard
                },


                {
                    path: 'theme',
                    redirect: '/theme/colors',
                    name: 'Theme',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'colors',
                            name: 'Colors',
                            component: Colors
                        },
                        {
                            path: 'typography',
                            name: 'Typography',
                            component: Typography
                        }
                    ]
                },
                {
                    path: 'charts',
                    name: 'Charts',
                    component: Charts
                },
                {
                    path: 'tables',
                    redirect: '/tables/tables',
                    name: 'Tables',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'tables',
                            name: 'Basic tables',
                            component: Tables
                        },
                        {
                            path: 'advanced-tables',
                            name: 'Advanced tables',
                            component: AdvancedTables
                        }
                    ]
                },
                {
                    path: 'widgets',
                    name: 'Widgets',
                    component: Widgets
                },
                {
                    path: 'users',
                    meta: { label: 'Users' },
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: '',
                            name: 'Users',
                            component: Users
                        },
                        {
                            path: ':id',
                            meta: {
                                label: 'User Details'
                            },
                            name: 'User',
                            component: User
                        }
                    ]
                },
                {
                    path: 'base',
                    redirect: '/base/cards',
                    name: 'Base',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'breadcrumbs',
                            name: 'Breadcrumbs',
                            component: Breadcrumbs
                        },
                        {
                            path: 'cards',
                            name: 'Cards',
                            component: Cards
                        },
                        {
                            path: 'carousels',
                            name: 'Carousels',
                            component: Carousels
                        },
                        {
                            path: 'collapses',
                            name: 'Collapses',
                            component: Collapses
                        },
                        {
                            path: 'jumbotrons',
                            name: 'Jumbotrons',
                            component: Jumbotrons
                        },
                        {
                            path: 'list-groups',
                            name: 'List Groups',
                            component: ListGroups
                        },
                        {
                            path: 'navs',
                            name: 'Navs',
                            component: Navs
                        },
                        {
                            path: 'navbars',
                            name: 'Navbars',
                            component: Navbars
                        },
                        {
                            path: 'paginations',
                            name: 'Paginations',
                            component: Paginations
                        },
                        {
                            path: 'popovers',
                            name: 'Popovers',
                            component: Popovers
                        },
                        {
                            path: 'progress-bars',
                            name: 'Progress Bars',
                            component: ProgressBars
                        },
                        {
                            path: 'switches',
                            name: 'Switches',
                            component: Switches
                        },
                        {
                            path: 'tabs',
                            name: 'Tabs',
                            component: Tabs
                        },
                        {
                            path: 'tooltips',
                            name: 'Tooltips',
                            component: Tooltips
                        }
                    ]
                },
                {
                    path: 'buttons',
                    redirect: '/buttons/standard-buttons',
                    name: 'Buttons',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'standard-buttons',
                            name: 'Standard Buttons',
                            component: StandardButtons
                        },
                        {
                            path: 'button-groups',
                            name: 'Button Groups',
                            component: ButtonGroups
                        },
                        {
                            path: 'dropdowns',
                            name: 'Dropdowns',
                            component: Dropdowns
                        },
                        {
                            path: 'brand-buttons',
                            name: 'Brand Buttons',
                            component: BrandButtons
                        }
                    ]
                },
                {
                    path: 'editors',
                    redirect: '/editors/text-editors',
                    name: 'Editors',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'text-editors',
                            name: 'Text Editors',
                            component: TextEditors
                        },
                        {
                            path: 'code-editors',
                            name: 'Code Editors',
                            component: CodeEditors
                        }
                    ]
                },
                {
                    path: 'forms',
                    redirect: '/forms/basic-forms',
                    name: 'Forms',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'basic-forms',
                            name: 'Basic Forms',
                            component: BasicForms
                        },
                        {
                            path: 'advanced-forms',
                            name: 'Advanced Forms',
                            component: AdvancedForms
                        },
                        {
                            path: 'validation-forms',
                            name: 'Form Validation',
                            component: ValidationForms
                        }
                    ]
                },
                {
                    path: 'google-maps',
                    name: 'Google Maps',
                    component: GoogleMaps
                },
                {
                    path: 'icons',
                    redirect: '/icons/font-awesome',
                    name: 'Icons',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'coreui-icons',
                            name: 'CoreUI Icons',
                            component: CoreUIIcons
                        },
                        {
                            path: 'flags',
                            name: 'Flags',
                            component: Flags
                        },
                        {
                            path: 'brands',
                            name: 'Brands',
                            component: Brands
                        }
                    ]
                },
                {
                    path: 'notifications',
                    redirect: '/notifications/alerts',
                    name: 'Notifications',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'alerts',
                            name: 'Alerts',
                            component: Alerts
                        },
                        {
                            path: 'badges',
                            name: 'Badges',
                            component: Badges
                        },
                        {
                            path: 'modals',
                            name: 'Modals',
                            component: Modals
                        },
                        {
                            path: 'toaster',
                            name: 'Toaster',
                            component: Toaster
                        }
                    ]
                },
                {
                    path: 'plugins',
                    redirect: '/plugins/draggable',
                    name: 'Plugins',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'draggable',
                            name: 'Draggable Cards',
                            component: Draggable
                        },
                        {
                            path: 'calendar',
                            name: 'Calendar',
                            component: Calendar
                        },
                        {
                            path: 'spinners',
                            name: 'Spinners',
                            component: Spinners
                        }
                    ]
                },

                {
                    path: 'apps',
                    name: 'Apps',
                    component: {
                        render(c) {
                            return c('router-view')
                        }
                    },
                    children: [
                        {
                            path: 'invoicing',
                            redirect: '/apps/invoicing/invoice',
                            name: 'Invoicing',
                            component: {
                                render(c) {
                                    return c('router-view')
                                }
                            },
                            children: [
                                {
                                    path: 'invoice',
                                    name: 'Invoice',
                                    component: Invoice
                                }
                            ]
                        },
                        {
                            path: 'email',
                            redirect: '/apps/email/inbox',
                            name: 'Email',
                            component: {
                                render(c) {
                                    return c('router-view')
                                }
                            },
                            children: [
                                {
                                    path: 'compose',
                                    name: 'Compose',
                                    component: Compose
                                },
                                {
                                    path: 'inbox',
                                    name: 'Inbox',
                                    component: Inbox
                                },
                                {
                                    path: 'message',
                                    name: 'Message',
                                    component: Message
                                }
                            ]
                        }
                    ]
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
                    path: '500',
                    name: 'Page500',
                    component: Page500
                },
                {
                    path: 'login',
                    name: 'Login',
                    component: Login
                },
                {
                    path: 'register',
                    name: 'Register',
                    component: Register
                }
            ]
        }
    ]
})
