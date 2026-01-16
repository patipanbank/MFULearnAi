import axios from 'axios';
import store from '@/store/store'

const instance = axios.create();

// instance.defaults.baseURL = 'https://api.example.com';
// instance.defaults.baseURL = 'https://api.competency.mfu.ac.th';
instance.defaults.baseURL = process.env.VUE_APP_API_URL;
// instance.defaults.timeout = 5000;

instance.defaults.headers = {
    "Content-Type": "application/json",
    // "Api-version": "1.0",
    "X-Access-Token": "1a661eec9bf358b8567c3dc022146d19c69d2ceafe92f503e89391e5d9f9f739",
}

//
// // เพิ่ม request interceptor
// instance.interceptors.request.use(
//     (config) => {
//       const token = `${store.state.XAccessToken}`;
//       if (token) {
//         config.headers.Authorization = `Bearer ${store.state.XAccessToken}`;
//       }
//
//       config.headers.lang  = `${store.getters['setting/lang']}`;
//       return config;
//     },
//     (error) => {
//       return Promise.reject(error);
//     }
// );
//
// // เพิ่ม Interceptor สำหรับ Response
// instance.interceptors.response.use(
//     (response) => {
//       // คืนค่าปกติหาก response สำเร็จ
//       return response;
//     },
//     (error) => {
//       // ตรวจสอบสถานะ 401
//       if (error.response && error.response.status === 401) {
//         // แสดง Dialog หรือ Popup
//         router.push('/login');
//       }
//       return Promise.reject(error);
//     }
// );

export default {


    authen(method, data, configs) {
        switch (method) {
            case 'sign-in':
                return instance.post("/api/v1/signin", data);
            case '2fa':
                return instance.post("/api/v1/2fa", data);
            case '2fa-send':
                return instance.put("/api/v1/2fa", data);
            default:
                break;
        }
    },

    message(method, data, configs) {
        switch (method) {
            case 'exp':
                return instance.post("/api/v1/setting/message/explorers", data);
            case 'get':
                return instance.get("/api/v1/setting/message");
            case 'post':
                return instance.post("/api/v1/setting/message", data);
            case 'put':
                return instance.put("/api/v1/setting/message", data);
            case 'delete':
                return instance.delete("/api/v1/setting/message");
            default:
                break;
        }
    },

    status(method, data, configs) {
        switch (method) {
            case 'exp':
                return instance.post("/api/v1/setting/status/explorers", data);
            case 'get':
                return instance.get("/api/v1/setting/status");
            case 'post':
                return instance.post("/api/v1/setting/status", data);
            case 'put':
                return instance.put("/api/v1/setting/status", data);
            case 'delete':
                return instance.delete("/api/v1/setting/status");
            default:
                break;
        }
    },

    verification(method, data, configs) {
        switch (method) {
            case 'exp':
                return instance.post("/api/v1/setting/verification/explorers", data);
            case 'get':
                return instance.get("/api/v1/setting/verification");
            case 'post':
                return instance.post("/api/v1/setting/verification", data);
            case 'put':
                return instance.put("/api/v1/setting/verification", data);
            case 'delete':
                return instance.delete("/api/v1/setting/verification");
            default:
                break;
        }
    },


    authenMessage(method, data, configs) {
        switch (method) {
            case 'exp':
                return instance.post("/api/v1/setting/auth/message/explorers", data);
            case 'get':
                return instance.get("/api/v1/setting/auth/message");
            case 'post':
                return instance.post("/api/v1/setting/auth/message", data);
            case 'put':
                return instance.put("/api/v1/setting/auth/message", data);
            case 'delete':
                return instance.delete("/api/v1/setting/auth/message");
            default:
                break;
        }
    },





    organization(method, data, configs) {
        switch (method) {
            case 'explorers':
                return instance.post("/api/v1/organization/explorers", data);
            default:
                break;
        }
    },

    // facultys(method, data, configs) {
    //     switch (method) {
    //         case 'get':
    //             return instance.get("/api/v1/setting/faculty");
    //         case 'post':
    //             delete data._id;
    //             return instance.post("/api/v1/setting/faculty", data);
    //         case 'put':
    //             return instance.put("/api/v1/setting/faculty", data);
    //         case 'delete':
    //             return instance.delete("/api/v1/setting/faculty");
    //         default:
    //             break;
    //     }
    // },
    agencies(method, data, configs) {
        switch (method) {
            case 'explorers':
                return instance.post("/api/v1/organization/agencies/explorers", data);
            // case 'get':
            //     return instance.get("/api/v1/setting/department");
            // case 'post':
            //     delete data._id;
            //     return instance.post("/api/v1/setting/department", data);
            // case 'put':
            //     return instance.put("/api/v1/setting/department", data);
            // case 'delete':
            //     return instance.delete("/api/v1/setting/department");
            default:
                break;
        }
    },

    department(method, data, configs) {
        switch (method) {
            case 'explorers':
                return instance.post("/api/v1/organization/department/explorers", data);
            // case 'get':
            //     return instance.get("/api/v1/setting/department");
            // case 'post':
            //     delete data._id;
            //     return instance.post("/api/v1/setting/department", data);
            // case 'put':
            //     return instance.put("/api/v1/setting/department", data);
            // case 'delete':
            //     return instance.delete("/api/v1/setting/department");
            default:
                break;
        }
    },


    members(method, data, configs) {
        switch (method) {
            case 'exp':
                return instance.post("/api/v1/system/profile", data);

            default:
                break;
        }
    },


    //
    roles(method, data, configs) {
        switch (method) {
            case 'exp':
                return instance.get("/api/v1/setting/role", data);
            case 'post':
                return instance.post("/api/v1/setting/role", data);
            case 'put':
                return instance.put("/api/v1/setting/role", data);

            default:
                break;
        }
    },


    // payment

    method(method, data, configs) {
        switch (method) {
            case 'exp':
                return instance.post("/api/v1/payment/method/explorers", data);
            case 'get':
                return instance.get("/api/v1/payment/method");
            case 'post':
                return instance.post("/api/v1/payment/method", data);
            case 'put':
                return instance.put("/api/v1/payment/method", data);
            case 'delete':
                return instance.delete("/api/v1/payment/method");
            default:
                break;
        }
    },

    payment(method, data, configs) {
        switch (method) {
            case 'explorers-transaction':
                return instance.post("/api/v1/payment/transaction/explorers", data);

            default:
                break;
        }
    },


}
