import Service from "../../../service/api.js";
import router from "../../../router/index.js";
import store from "@/store/store";

const LoginModule = {
    namespaced: true,
    state: {
        isSignIn:false,
        is2FA:false,
        userId:"66d1491da8ecd8d7d08981c2"

    },

    mutations: {
        isSignIn(state, obj) {
            state.isSignIn = obj
        },

        is2FA(state, obj) {
            state.is2FA = obj
        },

        userId(state, obj) {
            state.userId = obj
        },


    },

    actions: {
        supportReload({commit}, data) {

            var objs = JSON.parse(localStorage.getItem('objs'));

            store.commit('xAccessToken',objs.xAccessToken)
            // store.commit('accounts',objs.accounts)
            store.commit('auth/userId',objs.accounts)
            store.dispatch('personal/config',{})

        },


        singIn({commit}, data) {
            store.commit("dialog/loading",true)
            Service.authen("sign-in",data)
                .then((response) => {

                    // store.commit("auth/isSignIn",false)
                    // var objs = JSON.stringify(response.data.data)
                    // localStorage.setItem('objs',objs);
                    //
                    // store.dispatch("auth/supportReload",{})
                    // store.commit("dialog/loading",false)
                    //
                    //
                    // router.push('/estimate/yourself');
                })
                .catch((err) => {
                    store.commit("dialog/loading",false)

                    var dialog = {
                        message: "Username และ Password ไม่ถูกต้อง",
                        code:"40100",
                        number :"1",
                        status:true
                    }
                    store.commit("dialog/dialog",dialog)
                });
        },


        twofa({commit}, data) {
            store.commit("dialog/loading",true)
            Service.authen("2fa",data)
                .then((response) => {
                    store.commit("dialog/loading",false)
                    // store.commit("auth/is2FA",true)

                })
                .catch((err) => {
                    store.commit("dialog/loading",false)

                    var dialog = {
                        message: "Username และ Password ไม่ถูกต้อง",
                        code:"40100",
                        number :"1",
                        status:true
                    }
                    store.commit("dialog/dialog",dialog)
                });
        },

        twofaSend({commit}, data) {
            store.commit("dialog/loading",true)
            Service.authen("2fa-send",data)
                .then((response) => {
                    store.commit("dialog/loading",false)
                    store.commit("auth/is2FA",false)

                })
                .catch((err) => {
                    store.commit("dialog/loading",false)

                    var dialog = {
                        message: "Username และ Password ไม่ถูกต้อง",
                        code:"40100",
                        number :"1",
                        status:true
                    }
                    store.commit("dialog/dialog",dialog)
                });
        }

    },

    getters: {
        isSignIn(state) {
            return state.isSignIn;
        },

        is2FA(state) {
            return state.is2FA
        },

        userId(state) {
            return state.userId;
        },
    },
};

export default LoginModule;
