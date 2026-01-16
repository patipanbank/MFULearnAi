<template>
  <div>
    <CRow>
      <CCol>
        <SignIn/>
        <TwoFA/>
      </CCol>
    </CRow>
  </div>
</template>
<script>
import {mapGetters} from 'vuex'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.min.css'
import moment from "moment";
import SignIn from "@/projects/components/dialog/SignIn.vue";
import TwoFA from "@/projects/components/dialog/TwoFA.vue";


export default {
  name: 'index',
  components: {TwoFA, SignIn, Multiselect},
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
