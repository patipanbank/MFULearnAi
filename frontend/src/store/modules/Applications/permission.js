import Service from "@/service/api-hub";
import store from "@/store/store";

const ServerModule = {
    namespaced: true,
    state: {
        objs : {}
    },

    mutations: {
        objs(state, obj) {
            state.objs = obj;
        }
    },

    actions: {
        expId({commit}, data) {
            Service.permissionn('expId', data, {})
                .then((response) => {
                    store.commit("application/permission/objs", response.data.data)
                }).catch((err) => {
            });
        },
    },

    getters: {
        objs(state, obj) {
            return state.objs;
        },
    },
};

export default ServerModule;
