import Vue from "vue";
import Vuex from "vuex";
Vue.use(Vuex);

import DialogMessages from "./modules/Dialog/index";
import Setting from './modules/Setting/index'

import Payment from  "@/store/modules/Payments/index";
import Organization from "@/store/modules/organization";
import Accounts from "@/store/modules/Accounts/index";
import Authentication from "@/store/modules/Authentication/index";



const state = {
  sidebarShow: 'responsive',
  sidebarMinimize: false,
  asideShow: false,
  darkMode: false
}

const mutations = {
  toggleSidebarDesktop (state) {
    const sidebarOpened = [true, 'responsive'].includes(state.sidebarShow)
    state.sidebarShow = sidebarOpened ? false : 'responsive'
  },
  toggleSidebarMobile (state) {
    const sidebarClosed = [false, 'responsive'].includes(state.sidebarShow)
    state.sidebarShow = sidebarClosed ? true : 'responsive'
  },
  set (state, [variable, value]) {
    state[variable] = value
  },
  toggle (state, variable) {
    state[variable] = !state[variable]
  }
}


export default new Vuex.Store({
  state,
  mutations,
  modules : {
      dialog: DialogMessages,
      setting : Setting,
      payment : Payment,
      organization : Organization,
    //
    //
    // campus : Campus,
    // faculty : Facultys,
    // departent : Departments,
    //
    //
      auth : Authentication,
    account : Accounts,
    //
    // roles : settingRoles,
    //
    //
    // // application
    //
    // application: Application,

  }
});
