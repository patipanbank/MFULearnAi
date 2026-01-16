import Vue from "vue";
import Vuex from "vuex";
import Service from "@/service/api.js";
import store from "@/store/store";

const ServerModule = {
    namespaced: true,
    state: {
        item : []
    },

    mutations: {
        departents(state, obj) {
            state.item = obj;
        }
    },

    actions: {
        config({commit}, data) {
            Service.departments('exp', data, {})
                .then((response) => {
                    store.commit("departent/departents", response.data.data)

                }).catch((err) => {
            });
        },
        create({commit}, data) {
            Service.departments('post', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
        update({commit}, data) {
            Service.departments('put', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
    },

    getters: {
        departents(state, obj) {
            return state.item;
        },
    },
};

export default ServerModule;
