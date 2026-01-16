import Service from "../../../service/api.js";
import router from "../../../router/index.js";
import store from "@/store/store";

const LoginModule = {
    namespaced: true,
    state: {
        isSignIn: false,
        token: localStorage.getItem('token') || '',
        user: JSON.parse(localStorage.getItem('user')) || {},
    },

    mutations: {
        setToken(state, token) {
            state.token = token;
            localStorage.setItem('token', token);
        },
        setUser(state, user) {
            state.user = user;
            localStorage.setItem('user', JSON.stringify(user));
        },
        logout(state) {
            state.token = '';
            state.user = {};
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    },

    actions: {
        signIn({ commit }, data) {
            store.commit("dialog/loading", true)
            Service.authen("sign-in", data)
                .then((response) => {
                    store.commit("dialog/loading", false);

                    const token = response.data.token || response.data.accessToken; // Adjust based on actual API response
                    const user = response.data.user;

                    if (token) {
                        commit('setToken', token);
                        commit('setUser', user || {});
                        router.push('/chat'); // Redirect to Chat after login
                    } else {
                        throw new Error('No token received');
                    }
                })
                .catch((err) => {
                    store.commit("dialog/loading", false);
                    console.error("Login error:", err);

                    var dialog = {
                        message: "Authentication Failed. Please check your credentials.",
                        code: "401",
                        status: true
                    }
                    store.commit("dialog/dialog", dialog);
                });
        },

        logout({ commit }) {
            commit('logout');
            router.push('/login');
        }
    },

    getters: {
        isAuthenticated(state) {
            return !!state.token;
        },
        currentUser(state) {
            return state.user;
        },
        userRole(state) {
            return state.user?.role;
        }
    },
};

export default LoginModule;
