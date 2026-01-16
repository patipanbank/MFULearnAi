<template>
  <CSidebar
      class="bg-style1"
      :minimize="minimize"
      unfoldable
      :show="show"
      @update:show="(value) => $store.commit('set', ['sidebarShow', value])"
  >
    <CSidebarBrand class="d-md-down-none" >
<!--      <CIcon-->
<!--          class="c-sidebar-brand-full"-->
<!--          name="logo"-->
<!--          size="custom-size"-->
<!--          :height="35"-->
<!--          viewBox="0 0 556 134"-->
<!--      />-->
      <div class="c-sidebar-brand-full" >
        <a href="/">
          <CRow >
            <img class="pt-2 pb-2" src="@/assets/logo.svg" height="60px">
            <CCol class="text-white">
              <p class="font-weight-bold mb-0 mt-2 h5">MFU</p>
              <p class="font-weight-bold">Dashboard System</p>
            </CCol>
          </CRow>
        </a>

      </div>


      <!--      <img src="@/assets/logo.svg" height="48"/>-->
      <CIcon
          class="c-sidebar-brand-minimized"
          name="logo"
          size="custom-size"
          :height="35"
          viewBox="0 0 110 134"
      />
    </CSidebarBrand>
    <CRenderFunction flat :contentToRender="navs"/>
<!--    <CSidebarMinimizer-->
<!--        class="c-d-md-down-none"-->
<!--        @click.native="$store.commit('toggle', 'sidebarMinimize')"-->
<!--    />-->
  </CSidebar>
</template>

<script>
import nav from './_nav'
// import TheSidebarProfile from "@/projects/components/Util/TheSidebarProfile";
export default {
  name: 'TheSidebar',
  components: {},


  // nav,
  computed: {
    show() {
      return this.$store.state.sidebarShow
    },
    minimize() {
      return this.$store.state.sidebarMinimize
    }
  },
  data: function () {
    return {
      navs: [{
        _name: 'CSidebarNav',
        _children: [

          {
            _name: 'CSidebarNavItem',
            name: 'Dashboard',
            to: '/dashboard',
            icon: 'cil-window-restore'
          },

          {
            _name: 'CSidebarNavTitle',
            _children: ['Theme']
          },
          {
            _name: 'CSidebarNavItem',
            name: 'Colors',
            to: '/theme/colors',
            icon: 'cil-drop'
          },
          {
            _name: 'CSidebarNavItem',
            name: 'Typography',
            to: '/theme/typography',
            icon: 'cil-pencil'
          },
          {
            _name: 'CSidebarNavTitle',
            _children: ['Components']
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Base',
            route: '/base',
            icon: 'cil-puzzle',
            items: [{
              name: 'Breadcrumbs',
              to: '/base/breadcrumbs'
            },
              {
                name: 'Cards',
                to: '/base/cards'
              },
              {
                name: 'Carousels',
                to: '/base/carousels'
              },
              {
                name: 'Collapses',
                to: '/base/collapses'
              },
              {
                name: 'Jumbotrons',
                to: '/base/jumbotrons'
              },
              {
                name: 'List Groups',
                to: '/base/list-groups'
              },
              {
                name: 'Navs',
                to: '/base/navs'
              },
              {
                name: 'Navbars',
                to: '/base/navbars'
              },
              {
                name: 'Paginations',
                to: '/base/paginations'
              },
              {
                name: 'Popovers',
                to: '/base/popovers'
              },
              {
                name: 'Progress Bars',
                to: '/base/progress-bars'
              },
              {
                name: 'Switches',
                to: '/base/switches'
              },
              {
                name: 'Tabs',
                to: '/base/tabs'
              },
              {
                name: 'Tooltips',
                to: '/base/tooltips'
              }
            ]
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Buttons',
            route: '/buttons',
            icon: 'cil-cursor',
            items: [{
              name: 'Buttons',
              to: '/buttons/standard-buttons'
            },
              {
                name: 'Button Dropdowns',
                to: '/buttons/dropdowns'
              },
              {
                name: 'Button Groups',
                to: '/buttons/button-groups'
              },
              {
                name: 'Brand Buttons',
                to: '/buttons/brand-buttons'
              }
            ]
          },
          {
            _name: 'CSidebarNavItem',
            name: 'Charts',
            to: '/charts',
            icon: 'cil-chart-pie'
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Editors',
            route: '/editors',
            icon: 'cil-code',
            items: [
              {
                name: 'Code editors',
                to: '/editors/code-editors',
                icon: 'cil-code',
                badge: {
                  color: 'danger',
                  text: 'PRO'
                }
              },
              {
                name: 'Text editors',
                to: '/editors/text-editors',
                icon: 'cil-justify-left'
              }
            ]
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Forms',
            route: '/forms',
            icon: 'cil-notes',
            items: [
              {
                name: 'Basic forms',
                to: '/forms/basic-forms'
              },
              {
                name: 'Advanced forms',
                to: '/forms/advanced-forms',
                badge: {
                  color: 'danger',
                  text: 'PRO'
                }
              },
              {
                name: 'Validation forms',
                to: '/forms/validation-forms',
                badge: {
                  color: 'danger',
                  text: 'PRO'
                }
              }
            ]
          },
          {
            _name: 'CSidebarNavItem',
            name: 'Google Maps',
            to: '/google-maps',
            icon: 'cil-map',
            badge: {
              color: 'danger',
              text: 'PRO'
            }
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Icons',
            route: '/icons',
            icon: 'cil-star',
            items: [{
              name: 'CoreUI Icons',
              to: '/icons/coreui-icons',
              badge: {
                color: 'info',
                text: 'NEW'
              }
            },
              {
                name: 'Brands',
                to: '/icons/brands'
              },
              {
                name: 'Flags',
                to: '/icons/flags'
              }
            ]
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Notifications',
            route: '/notifications',
            icon: 'cil-bell',
            items: [{
              name: 'Alerts',
              to: '/notifications/alerts',
            },
              {
                name: 'Badges',
                to: '/notifications/badges'
              },
              {
                name: 'Modals',
                to: '/notifications/modals'
              },
              {
                name: 'Toaster',
                to: '/notifications/toaster',
                badge: {
                  color: 'danger',
                  text: 'PRO'
                }
              }
            ]
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Plugins',
            route: '/plugins',
            icon: 'cil-input-power',
            items: [
              {
                name: 'Draggable',
                to: '/plugins/draggable',
                icon: 'cil-cursor-move',
                badge: {
                  color: 'danger',
                  text: 'PRO'
                }
              },
              {
                name: 'Calendar',
                to: '/plugins/calendar',
                icon: 'cil-calendar',
                badge: {
                  color: 'danger',
                  text: 'PRO'
                }
              },
              {
                name: 'Spinners',
                to: '/plugins/spinners',
                icon: 'cil-circle',
                badge: {
                  color: 'danger',
                  text: 'PRO'
                }
              }
            ]
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Tables',
            route: '/tables',
            icon: 'cil-list',
            items: [
              {
                name: 'Basic Tables',
                to: '/tables/tables',
                icon: 'cil-list',
              },
              {
                name: 'Advanced tables',
                to: '/tables/advanced-tables',
                icon: 'cil-list-rich'
              }
            ]
          },
          {
            _name: 'CSidebarNavItem',
            name: 'Widgets',
            to: '/widgets',
            icon: 'cil-calculator',
            badge: {
              color: 'primary',
              text: 'NEW',
              shape: 'pill'
            }
          },
          {
            _name: 'CSidebarNavDivider'
          },
          {
            _name: 'CSidebarNavTitle',
            _children: ['Extras']
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Pages',
            route: '/pages',
            icon: 'cil-star',
            items: [
              {
                name: 'Login',
                to: '/pages/login'
              },
              {
                name: 'Register',
                to: '/pages/register'
              },
              {
                name: 'Error 404',
                to: '/pages/404'
              },
              {
                name: 'Error 500',
                to: '/pages/500'
              }
            ]
          },
          {
            _name: 'CSidebarNavDropdown',
            name: 'Apps',
            route: '/apps',
            icon: 'cil-layers',
            _children: [
              {
                _name: 'CSidebarNavDropdown',
                name: 'Invoicing',
                route: '/apps/invoicing',
                icon: 'cil-spreadsheet',
                items: [
                  {
                    name: 'Invoice',
                    to: '/apps/invoicing/invoice',
                    badge: {
                      color: 'danger',
                      text: 'PRO'
                    }
                  }
                ]
              },
              {
                _name: 'CSidebarNavDropdown',
                name: 'Email',
                route: '/apps/email',
                icon: 'cil-envelope-closed',
                items: [
                  {
                    name: 'Inbox',
                    to: '/apps/email/inbox',
                    icon: 'cil-envelope-closed',
                    badge: {
                      color: 'danger',
                      text: 'PRO'
                    }
                  },
                  {
                    name: 'Message',
                    to: '/apps/email/message',
                    icon: 'cil-envelope-open',
                    badge: {
                      color: 'danger',
                      text: 'PRO'
                    }
                  },
                  {
                    name: 'Compose',
                    to: '/apps/email/compose',
                    icon: 'cil-envelope-letter',
                    badge: {
                      color: 'danger',
                      text: 'PRO'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }]
    }
  }
}
</script>

<style>
.bg-style1{
  background: linear-gradient(30deg,#FEC260 0%,#8c1515 60%);
}
</style>
