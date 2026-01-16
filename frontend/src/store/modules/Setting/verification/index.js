
import Service from "@/service/api.js";
import store from "@/store/store";

const module = {
    namespaced: true,
    state: {
        item : []
    },

    mutations: {
        item(state, obj) {
            state.item = obj;
        }
    },


    // router.get("/message", message.onQuerys);
    // router.post("/message", message.onCreate);
    // router.put("/message", message.onUpdate);
    // router.delete("/message", message.onDelete);

    actions: {
        get({commit}, data) {
            Service.verification('get', {}, {})
                .then((response) => {
                    store.commit("setting/verification/item", response.data.data)
                }).catch((err) => {
            });
        },
        post({commit}, data) {
            Service.verification('post', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
        put({commit}, data) {
            Service.verification('put', data, {})
                .then((response) => {

                }).catch((err) => {
            });
        },
        delete({commit}, data) {
            Service.verification('delete', data, {})
                .then((response) => {

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

export default module;
