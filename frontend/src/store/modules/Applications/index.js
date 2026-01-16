import Vue from "vue";
import Vuex from "vuex";
import store from "@/store/store";
import Service from "@/service/api";
import information from './information'
import tenant from './tenant'
import type from './type'
import mode from './mode'
import platform from './platform'
import state from './state'

import permission from './permission'


const ServerModule = {
    namespaced: true,
    modules: {
        information,
        tenant,
        type,
        state,
        mode,
        platform,
        permission
    },

    // state: {
    //     item : []
    // },
    //
    // mutations: {
    //     item(state, obj) {
    //         state.item = obj;
    //     }
    // },
    //
    // actions: {
    //     config({commit}, data) {
    //         Service.members('exp', data, {})
    //             .then((response) => {
    //                 store.commit("account/item", response.data.data)
    //             }).catch((err) => {
    //         });
    //     },
    // },
    //
    // getters: {
    //     item(state, obj) {
    //         return state.item;
    //     },
    // },
};

export default ServerModule;
