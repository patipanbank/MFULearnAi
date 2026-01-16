
import Service from "@/service/api.js";
import store from "@/store/store";

const ServerModule = {
    namespaced: true,
    state: {
        item : []
    },

    mutations: {
        campus(state, obj) {
            state.item = obj;
        }
    },

    actions: {
        config({commit}, data) {
            Service.campus('exp', {}, {})
                .then((response) => {
                    store.commit("campus/campus", response.data.data)
                }).catch((err) => {
            });
        },
        create({commit}, data) {
            Service.campus('post', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
        update({commit}, data) {
            Service.campus('put', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
    },

    getters: {
        campus(state, obj) {
            return state.item;
        },
    },
};

export default ServerModule;
