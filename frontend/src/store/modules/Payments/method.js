
import Service from "@/service/api";
import store from "@/store/store";

const ServerModule = {
    namespaced: true,
    state: {
        item : [],
    },

    mutations: {
        item(state, obj) {
            state.item = obj;
        },

    },

    actions: {
        get({commit}, data) {
            Service.method('get', data, {})
                .then((response) => {
                    store.commit("payment/method/item", response.data.data)
                }).catch((err) => {
            });
        },


    },

    getters: {
        item(state, obj) {
            return state.item;
        },
    },
};

export default ServerModule;
