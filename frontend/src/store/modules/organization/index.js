import Service from "@/service/api";
import store from "@/store/store";

const ServerModule = {
    namespaced: true,
    // modules: {
    //     method,
    // },

    state: {
        organization : [],
        agencies : [],
        department : []
    },

    mutations: {
        organization(state, obj) {
            state.organization = obj;
        },
        agencies(state, obj) {
            state.agencies = obj;
        },
        department(state, obj) {
            state.department = obj;
        },
    },

    actions: {
        // config({commit}, data) {
        //     Service.members('exp', data, {})
        //         .then((response) => {
        //             store.commit("account/item", response.data.data)
        //         }).catch((err) => {
        //     });
        // },

        organization({commit}, data) {
            Service.organization('explorers', data, {})
                .then((response) => {
                    store.commit("organization/organization", response.data.data)
                }).catch((err) => {
            });
        },
        agencies({commit}, data) {
            Service.agencies('explorers', data, {})
                .then((response) => {
                    store.commit("organization/agencies", response.data.data)
                }).catch((err) => {
            });
        },
        department({commit}, data) {
            Service.department('explorers', data, {})
                .then((response) => {
                    store.commit("organization/department", response.data.data)
                }).catch((err) => {
            });
        },
    },

    getters: {
        organization(state){
            return state.organization;
        },
        agencies(state){
            return state.agencies;
        },
        department(state){
            return state.department;
        },
    },
};

export default ServerModule;
