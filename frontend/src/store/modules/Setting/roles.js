import store from "@/store/store";
import Service from "@/service/api";

const ServerModule = {
    namespaced: true,
    state: {
        isReload: false,
        item : []
    },

    mutations: {
        isReload(state, obj) {
            state.isReload = obj;
        },
        item(state, obj) {
            state.item = obj;
        }
    },

    actions: {
        config({commit}, data) {
            Service.roles('exp', data, {})
                .then((response) => {
                    store.commit("roles/item", response.data.data)
                }).catch((err) => {
            });
        },
        create({commit}, data) {
            Service.roles('post', data, {})
                .then((response) => {
                    store.commit("roles/isReload", true)

                }).catch((err) => {
            });
        },
        update({commit}, data) {
            Service.roles('put', data, {})
                .then((response) => {
                    store.commit("roles/isReload", true)
                }).catch((err) => {
            });
        },

        remove({commit}, data) {
            Service.roles('delete', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
    },

    getters: {
        item(state, obj) {
            return state.item;
        },

        isReload(state, obj) {
            return state.isReload;
        }
    },
};

export default ServerModule;
