<template>
  <div>
    <div v-html='html'></div>
    <CRow class="mb-4" v-for="objs in application" :key="objs.name">
      <CCol>
        <MAppItem :caption="objs.name" :icon="objs.icon" :item="objs.item"/>
      </CCol>
    </CRow>


  </div>
</template>
<script>
import {mapGetters} from 'vuex'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.min.css'
import moment from "moment";
import MAppItem from "@/projects/views/dashboards/components/MAppItem.vue";
import VPersonal from "@/projects/views/dashboards/components/VPersonal.vue";


export default {
  name: 'index',
  components: {VPersonal, MAppItem, Multiselect},
  props: {
    icon: {
      type: String,
      default: 'cil-user'
    },
    caption: {
      type: String,
      default: 'Create / Update'
    },

  },
  data() {
    return {
      application : [
        {
          _id : "1",

          name : "Events",
          icon : "cil-bowling",

          item : [
            {name : "Application", badge : 0, icon : "cil-speedometer"},
          ]
        },
        {
          _id : "2",

          name : "Services",
          icon : "cil-paint",

          item : [
            {name : "Application", badge : 100, icon : "cil-speedometer"},
          ]
        },
        {
          _id : "3",

          name : "Application",
          icon : "cil-screen-smartphone",

          item : [
            {name : "Application", badge : 100, icon : "cil-speedometer"},
          ]
        },
        {
          _id : "4",

          name : "Business Intelligence",
          icon : "cil-briefcase",

          item : [
            {name : "Application", badge : 100, icon : "cil-speedometer"},
          ]
        }
      ],
      html:''

    }
  },

  mounted() {

  },

  created() {
    this.onInit();
  },

  beforeDestroy() {

  },

  methods: {
    onInit() {

    },


  },

  computed: {
    ...mapGetters({
      lang: 'setting/lang',
    })
  },

  watch: {

  }
}

</script>
<style>
.w-16{
  width: 4rem;
}
.h-16{
  height: 4rem;
}
.item-content{
  cursor: pointer;
  border-radius: 1rem;
  animation: 2s ease-in-out 0s infinite normal none running highlight-glow;
  box-shadow: rgba(239, 68, 68, 0.3) 0px 0px 20px, rgba(239, 68, 68, 0.2) 0px 0px 30px, rgba(239, 68, 68, 0.1) 0px 0px 40px;
  border: 2px solid rgb(239, 68, 68);
}

.bage-notification {
  position: absolute;
  top: -1rem;
  right: -1rem;
  background-color: #ac1515;
  border-radius: 1rem;
  display: block;
}
</style>
