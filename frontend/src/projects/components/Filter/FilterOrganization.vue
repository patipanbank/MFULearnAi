<template>
  <div>
    <CRow class="mb-4">
      <CCol>
        <CCard class="bg-style2">
          <CCardHeader class="bg-gradient-dark text-white" style="border-top-left-radius: 1rem; border-top-right-radius: 1rem ">
            <span class="font-weight-bold h6"><CIcon name="cil-speedometer" size="lg"/> {{ caption }}</span>
          </CCardHeader>
          <CCardBody>
            <CRow>
              <CCol col="12">
                <CRow class="mb-3">
                  <CCol col="3">
                    <label class="mt-2"> องค์กร </label>
                  </CCol>
                  <CCol>
                    <Multiselect class="os"
                                 v-model="select.organization"
                                 :options="options.organization"
                                 label="label"
                                 track-by="label"
                                 :multiple="false"
                                 :search="true"
                    >
                    </Multiselect>
                  </CCol>
                </CRow>
              </CCol>
              <CCol col="12">
                <CRow class="mb-3">
                  <CCol col="3">
                    <label class="mt-2"> หน่วยงาน </label>
                  </CCol>
                  <CCol>
                    <Multiselect class="os"
                                 v-model="select.agencies"
                                 :options="options.agencies"
                                 label="label"
                                 track-by="label"
                                 :multiple="false"
                                 :search="true"
                    >
                    </Multiselect>
                  </CCol>
                </CRow>
              </CCol>
              <CCol col="12">
                <CRow>
                  <CCol col="3">
                    <label class="mt-2"> สำนัก </label>
                  </CCol>
                  <CCol>
                    <Multiselect class="os"
                                 v-model="select.department"
                                 :options="options.department"
                                 label="label"
                                 track-by="label"
                                 :multiple="false"
                                 :search="true"
                    >
                    </Multiselect>
                  </CCol>
                </CRow>
              </CCol>
            </CRow>

<!--            <CRow>-->
<!--              <CCol col="3" class="mt-3">-->
<!--                <label> วันที่เวลา </label>-->
<!--              </CCol>-->
<!--              <CCol  class="mt-3">-->
<!--                <div class=" ">-->
<!--                  <CButtonGroup class="float-left mr-3 mt-1">-->
<!--                    <CButton-->
<!--                        class="flex-fill"-->
<!--                        v-for="opt in styles"-->
<!--                        :key="opt.id"-->
<!--                        color="info"-->
<!--                        variant="outline"-->
<!--                        :pressed="select.id === opt.id"-->
<!--                        @click="selectStyle(opt)">-->
<!--                      {{ opt.label }}-->
<!--                    </CButton>-->

<!--                  </CButtonGroup>-->

<!--                  <CInput class="float-left pt-0" type="date"  v-model="select.startDate"/>-->
<!--                  <span class="float-left m-2">-</span>-->
<!--                  <CInput  class="float-left" type="date"   v-model="select.endDate"/>-->
<!--                </div>-->
<!--              </CCol>-->
<!--            </CRow>-->

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

import optionsMixin from '@/mixins/optionsMixin'

export default {
  name: 'FilterOrganization',
  mixins: [optionsMixin], // ✅ ใช้ mixin ที่เราสร้างไว้
  components: {Multiselect},
  props: {
    caption: {
      type: String,
      default: "Filters"
    },
    disable: {
      type: Boolean,
      default: false
    },
    // option: {
    //   type: Object,
    //   default: {}
    // }
  },
  data: function () {
    return {
      options: {
        organization: [],
        agencies: [],
        department:[]
      },

      select: {
        organization:"",
        agencies:"",
        department:"",
        startDate: new moment().format("YYYY-MM-DDTHH:mm"),
        endDate:new moment().format("YYYY-MM-DDTHH:mm"),
        id: 1,
      },

      styles: [
        { id: 1, label: 'วันนี่', startDate:moment().format("YYYY-MM-DD"), endDate:moment().add(1, "days").format("YYYY-MM-DD")},
        { id: 2, label: 'เมื่อวาน', startDate: moment().subtract(1, "days").format("YYYY-MM-DD"), endDate: moment().format("YYYY-MM-DD")},
        { id: 3, label: 'สัปดานี้', startDate: moment().startOf('week').add(1, 'days').format("YYYY-MM-DD"), endDate: moment().add(1, 'days').format("YYYY-MM-DD")},
        { id: 4, label: 'สัปดาก่อนหน้า', startDate: moment().subtract(1, 'weeks').startOf('week').add(1, 'days').format("YYYY-MM-DD"), endDate: moment().subtract(1, 'weeks').endOf('week').add(1, 'days').format("YYYY-MM-DD")},
      ],
    }


  },

  mounted() {
  },

  created() {
    this.onInit()

  },
  beforeDestroy() {

  },

  methods: {
    onInit() {

      this.$store.dispatch("organization/organization",{})
      this.$store.dispatch("organization/agencies",{})
      this.$store.dispatch("organization/department",{})
      // this.$store.dispatch("agency/config",{})

    },

    //
    // onSelectOrganizations(value, e) {
    //   this.option.campusId = value;
    //   this.$emit("option", this.option)
    // },
    //
    // onSelectAgencys(value, e) {
    //   this.option.agency = value;
    //   this.$emit("option", this.option)
    // },

    selectStyle(opt) {
      this.select = opt;
      console.log(opt)
    }
  },



  computed: {
    ...mapGetters({
      lang: 'setting/lang',
      organization: 'organization/organization',
      agencies: 'organization/agencies',
      department: 'organization/department',
    }),
  },

  watch: {

    lang: function (value) {

      this.options.organization = this.buildOptions(this.organization)
      this.options.agencies = this.buildOptions(this.agencies)
      this.options.department = this.buildOptions(this.department)

    },

    organization(value) {
      this.options.organization = this.buildOptions(value);

      this.select.organization = this.options.organization[0];

    },

    agencies(value) {
      this.options.agencies = this.buildOptions(value);
    },

    department(value) {
      this.options.department = this.buildOptions(value);
    },

    agencySelect(value){
      // this.option.agency = value.value;
      // this.$emit("option", this.option)
    }
  }

}
</script>
<style>


</style>
