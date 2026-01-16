
import Service from "@/service/api-hub";
import store from "@/store/store";

const ServerModule = {
    namespaced: true,
    state: {
        item : []
    },

    mutations: {
        item(state, obj) {
            state.item = obj;
        }
    },

    actions: {
        config({commit}, data) {
            Service.type('exp', {}, {})
                .then((response) => {
                    store.commit("application/type/item", response.data.data)
                }).catch((err) => {
            });
        },
        // create({commit}, data) {
        //     Service.campus('post', data, {})
        //         .then((response) => {
        //
        //         }).catch((err) => {
        //     });
        // },
        // update({commit}, data) {
        //     Service.campus('put', data, {})
        //         .then((response) => {
        //
        //         }).catch((err) => {
        //     });
        // },
    },

    getters: {
        item(state, obj) {
            return state.item;
        },
    },
};

export default ServerModule;
