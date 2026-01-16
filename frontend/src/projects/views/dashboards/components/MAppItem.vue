<template>
  <div>
    <CRow>
      <CCol>
        <CCard class="bg-style2 ">
          <CCardBody>
            <CRow>
              <CCol class="mb-3">
                <span class="font-weight-bold h6">
                  <CIcon :name="icon" size="xl" class="mr-2"/> {{ caption }}
                </span>
              </CCol>
              <CCol col="2" class="text-right">
                <span class="font-weight-bold"> {{ item.length }} </span>
              </CCol>
            </CRow>

            <CRow>
              <CCol class="text-center mt-2 mb-2" col="3" md="2"  v-for="objs in item" :key="objs.name">
                <div class="d-flex align-items-center justify-content-center" >
                  <div class="position-relative d-flex align-items-center justify-content-center bg-white border item-content" style="width: 4rem; height: 4rem; border-radius: 1rem;">

                    <!-- วงกลมสถานะ -->
                    <span class="p-1 badge-notification" v-if="objs.badge > 0">
                      <label class="m-0 text-white font-weight-bold pl-1 pr-1"> {{ (objs.badge > 99)? "99+":objs.badge  }} </label>
                    </span>

                    <!-- ไอคอนตรงกลาง -->
                    <CIcon :name="objs.icon" size="2xl" />
                  </div>
                </div>
                <p class="text-center mt-2 font-weight-bold"> {{ objs.name }} </p>

              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </div>
</template>
<script>
import {mapGetters} from 'vuex'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.min.css'
import moment from "moment";


export default {
  name: 'MAppItem',
  components: {Multiselect},
  props: {
    icon: {
      type: String,
      default: 'cil-speedometer'
    },
    caption: {
      type: String,
      default: 'Create / Update'
    },
    item:{
      type: Array,
      default: () => {
        return []
      }
    }

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
<style scoped>
.item-content{
  cursor: pointer;
  border-radius: 1rem;
  animation: 2s ease-in-out 0s infinite normal none running highlight-glow;
  box-shadow: rgba(239, 68, 68, 0.3) 0px 0px 20px, rgba(239, 68, 68, 0.2) 0px 0px 30px, rgba(239, 68, 68, 0.1) 0px 0px 40px;
  border: 2px solid rgb(239, 68, 68);
}

.badge-notification {
  position: absolute;
  top: -1rem;
  right: -1rem;
  background-color: #ac1515;
  border-radius: 1rem;
  display: block;
}
</style>
