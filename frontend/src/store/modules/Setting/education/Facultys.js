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
        facultys(state, obj) {
            state.item = obj;
        }
    },

    actions: {
        config({commit}, data) {
            Service.facultys('get', data, {})
                .then((response) => {
                    store.commit("faculty/facultys", response.data.data)

                }).catch((err) => {
            });
        },
        create({commit}, data) {
            Service.facultys('post', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
        update({commit}, data) {
            Service.facultys('put', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
    },

    getters: {
        facultys(state, obj) {
            return state.item;
        },
    },
};

export default ServerModule;
