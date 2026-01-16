
import Service from "@/service/api-hub";
import store from "@/store/store";

const ServerModule = {
    namespaced: true,
    state: {
        item : [],
        application : []
    },

    mutations: {
        item(state, obj) {
            state.item = obj;
        },
        application(state, obj) {
            // state.application = obj;

            state.application.push(obj)
        }
    },

    actions: {
        expApplicationId({commit}, data) {
            Service.infomation('expId', data, {})
                .then((response) => {
                    store.commit("application/information/application", response.data.data)
                }).catch((err) => {
            });
        },

        config({commit}, data) {
            Service.infomation('exp', {}, {})
                .then((response) => {
                    console.log(response.data.data);
                    store.commit("application/information/item", response.data.data)
                }).catch((err) => {
            });
        },
        create({commit}, data) {
            Service.infomation('post', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
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
        application(state, obj) {
            return state.application;
        },
    },
};

export default ServerModule;
