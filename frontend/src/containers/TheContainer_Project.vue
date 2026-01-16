<template>
  <div class="c-app" :class="{ 'c-dark-theme': $store.state.darkMode }">
    <TheSidebar_Project/>
    <TheAside/>
    <CWrapper>
      <TheHeader/>
      <div class="c-body">
        <main class="c-main">
          <CContainer fluid>
            <transition name="fade">
              <router-view></router-view>
            </transition>
          </CContainer>
        </main>
        <TheFooter/>
      </div>
    </CWrapper>
    <CenterLoading/>
    <DialogMessage/>
    <SignIn/>

  </div>
</template>

<script>
import TheSidebar from './TheSidebar'
import TheHeader from './TheHeader'
import TheFooter from './TheFooter'
import TheAside from './TheAside'
import {mapGetters} from "vuex";
import store from "@/store/store";
//
import { io } from "socket.io-client";
import DialogMessage from "@/projects/components/dialog/DialogMessage.vue";
import CenterLoading from "@/projects/components/dialog/CenterLoading.vue";
import SignIn from "@/projects/components/dialog/SignIn.vue";
import TheSidebar_Project from "@/containers/TheSidebar_Project.vue";
//
export default {
  name: 'TheContainer_Project',
  components: {
    TheSidebar_Project,
    SignIn,
    CenterLoading,
    DialogMessage,
    TheSidebar,
    TheHeader,
    TheFooter,
    TheAside
  },

  mounted() {

    // this.notifyUser();
    this.showNotification();

//     const socket = io("127.0.0.1:8082",{
//       transports: ["websocket", "polling"],
//       withCredentials: true,
//       extraHeaders: {
//         "my-custom-header": "abcd"
//       }
//     });
//     socket.on("connect", () => {
//       socket.emit('campus',{"sos":1122});
//
//       socket.on("campus", (reason) => {
//         console.log(reason)
//       })
//
//
//     });
//
//
//
// // กรณีการเชื่อมต่อถูกตัดขาด
//     socket.on("disconnect", (reason) => {
//       console.log("[socket disconnected]: ", reason);
//     });
// // กรณีการเชื่อมต่อเกิดความผิดพลาด
//     socket.on("connect_error", (error) => {
//       console.error("[connect error]: ", error);
//     });


    // localStorage.setItem('test','123444')

    // socket.on("connect", () => {
    //   console.log(12)
    // });
    //
    // socket.on("disconnect", () => {
    //   console.log(13)
    //
    // });
  },

  methods: {
    notifyUser() {
      // Check if the browser supports notifications
      if (!('Notification' in window)) {
        alert('This browser does not support desktop notifications');
        return;
      }

      // Check whether notification permissions have already been granted
      if (Notification.permission === 'granted') {
        // If it's okay let's create a notification
        this.showNotification();
      } else if (Notification.permission !== 'denied') {
        // Otherwise, we need to ask the user for permission
        Notification.requestPermission().then(permission => {
          // If the user accepts, let's create a notification
          if (permission === 'granted') {
            this.showNotification();
          }
        });
      }
    },
    showNotification() {
      const title = 'Hello from Vue.js!';
      const options = {
        body: 'This is a simple notification example.',
        icon: 'https://via.placeholder.com/100', // Optional: Path to icon image
        vibrate: [200, 100, 200], // Optional: Vibration pattern
      };

      new Notification(title, options);
    }
  },
  computed: {
    ...mapGetters({
    })
  },

  watch: {

  }

}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
