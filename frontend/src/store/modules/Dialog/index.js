import router from "@/router";
import store from "@/store/store";

const DialogModule = {
    namespaced: true,
    state: {
        dialog: {
            message: "asdsadsad",
            code: "20000",
            number: "1",
            status: false,
            button: [{
                label: "CANCEL",
                icon: "cil-ban",
                color: "danger",
                code: "cancel"

            }]
        },

        isCode: null,
        loading: false,
        message: 0,

    },

    mutations: {

        loading(state, data) {
            state.loading = data
        },

        message(state, data) {
            state.message = data
        },

        dialog(state, data) {
            console.log("dialog", data)
            state.dialog = data
        },

        isCode(state, data) {
            state.isCode = data
        },

    },

    actions: {},

    getters: {

        loading(state) {
            return state.loading
        },

        message(state) {
            return state.message
        },

        dialog(state) {
            return state.dialog
        },

        isCode(state) {
            return state.isCode
        },


    },
};

export default DialogModule;
