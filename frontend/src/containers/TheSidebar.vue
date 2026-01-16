<template>
  <CSidebar
      class="bg-style1"
      :minimize="minimize"
      unfoldable
      :show="show"
      @update:show="(value) => $store.commit('set', ['sidebarShow', value])"
  >
    <CSidebarBrand class="d-md-down-none" >
      <div class="c-sidebar-brand-full" >
        <a href="/">
          <CRow >
            <img class="pt-2 pb-2" src="@/assets/logo.svg" height="60px">
            <CCol class="text-white">
              <p class="font-weight-bold mb-0 mt-2 h5">MFU</p>
              <p class="font-weight-bold">MFU LearnAi</p>
            </CCol>
          </CRow>
        </a>
      </div>
      <CIcon
          class="c-sidebar-brand-minimized"
          name="logo"
          size="custom-size"
          :height="35"
          viewBox="0 0 110 134"
      />
    </CSidebarBrand>
    <CRenderFunction flat :contentToRender="navs"/>
  </CSidebar>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'TheSidebar',
  computed: {
    ...mapGetters('auth', ['userRole']), // Helper to get auth/userRole
    
    show() {
      return this.$store.state.sidebarShow
    },
    minimize() {
      return this.$store.state.sidebarMinimize
    },
    navs() {
      // Base navigation for Everyone
      const items = [
        {
          _name: 'CSidebarNavItem',
          name: 'Chat',
          to: '/chat',
          icon: 'cil-chat-bubble'
        },
        {
          _name: 'CSidebarNavItem',
          name: 'Knowledge Base',
          to: '/knowledge',
          icon: 'cil-book'
        }
      ];

      // SuperAdmin Only Items
      if (this.userRole === 'SuperAdmin') {
         items.unshift({ // Add to top or where preferred
          _name: 'CSidebarNavItem',
          name: 'Dashboard',
          to: '/dashboard',
          icon: 'cil-speedometer'
        });
        
        items.push({
             _name: 'CSidebarNavTitle',
             _children: ['Admin']
        });
        
        items.push({
            _name: 'CSidebarNavItem',
            name: 'Settings',
            to: '/settings',
            icon: 'cil-settings'
        });
      }

      return [{
        _name: 'CSidebarNav',
        _children: items
      }];
    }
  }
}
</script>

<style>
.bg-style1{
  background: linear-gradient(30deg,#FEC260 0%,#8c1515 60%);
}
</style>
