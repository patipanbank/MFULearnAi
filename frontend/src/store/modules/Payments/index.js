
import Service from "@/service/api";
import store from "@/store/store";
import method from './method'


const ServerModule = {
    namespaced: true,
    modules: {
        method,
    },

    state: {
        item : []
    },

    mutations: {
        item(state, obj) {
            state.item = obj;
        }
    },

    actions: {
        expTransaction({commit}, data) {
            Service.payment('explorers-transaction', data, {})
                .then((response) => {
                    store.commit("payment/item", response.data.data)
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
