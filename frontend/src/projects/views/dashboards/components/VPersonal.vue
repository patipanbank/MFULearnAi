<template>
  <div>
    <CCard class="bg-style2 ">
      <CCardHeader class="bg-gradient-danger text-white" style="border-top-left-radius: 1rem; border-top-right-radius: 1rem ">
        <span  class="font-weight-bold h6">
          <CIcon  :name="icon" class="mr-2"/> {{ caption }}
        </span>
      </CCardHeader>
      <CCardBody>
        <CRow>
          <CCol class="text-center">
            <div class="c-avatar bg-white animateds" style="width: 150px; height: 150px" >
              <label for="fusk">
                <img class="c-avatar-img" :src="src" width="100%" />
                <div class="image-upload" style="position: absolute; top: 0px; left: 0%; background-color: orange;">
                  <i class="icon-camera icons font-4xl d-block mt-4"></i>
                </div>
              </label>
              <input id="fusk" type="file" name="photo" @change=uploadImage style="display: none;">
              <div class="c-avatar position-absolute  bg-warning" style="width: 40px; height: 40px; bottom: 0; right: 0px;" >
                <CIcon name="cil-camera" class="text-white" />
              </div>

            </div>
          </CCol>
        </CRow>
        <CRow>
          <CCol class="text-center mt-2 mb-3">
            <label class="font-weight-bold">{{ name }}</label>
          </CCol>
        </CRow>
        <CRow v-for="objs in info" :key="objs.title" >
          <CCol>
            <p class="mb-0 font-weight-bold"> <CIcon :name="objs.icon" class="mr-2"/> {{ objs.title }} </p>
            <p class="pl-3 ml-1 mb-1"> {{ objs.value }}</p>
          </CCol>
        </CRow>

        <CRow class="mt-3">
          <CCol>
            <CDropdownDivider/>
          </CCol>
          <label class="text-dark font-weight-bold text-center h6"> SIGN IN WITH SOCIAL </label>
          <CCol>
            <CDropdownDivider/>
          </CCol>
        </CRow>

        <CRow class="mt-3">
          <CCol class="text-center">
            <img class="mr-1 zoom" src="@/assets/icons/logo-facebook.png" width="30px" :class="(link.facebook == null)?'image-bw':''"/>
            <img class="mr-1 zoom" src="@/assets/icons/logo-instagram.png" width="30px" :class="(link.instagram == null)?'image-bw':''"/>
            <img class="zoom" src="@/assets/icons/logo-google.png" width="30px" :class="(link.google == null)?'image-bw':''"/>
          </CCol>
        </CRow>



      </CCardBody>
    </CCard>
  </div>
</template>

<script>


import {mapGetters} from 'vuex'

export default {
  name: 'VPersonal',
  props:{
    icon: {
      type: String,
      default: 'cil-user'
    },
    caption: {
      type: String,
      default:  'Profile'
    },
    disable: {
      type: Boolean,
      default: false
    }
  },
  data: function () {
    return {
      src : "img/avatars/1.jpg",
      name : "Saksith Rittanasatheiyn",
      info : [

        { icon: "cil-sitemap", title : 'หน่วยงาน', value : 'ศูนย์บริการ' },
        { icon: "cil-school", title : 'สาขา', value : 'ศูนย์เทคโนโลยีสารสนเทศ' },
        { icon: "cil-briefcase", title : 'ตำแหน่ง', value : 'เจ้าหน้าที่' },
        { icon: "cil-screen-smartphone", title : 'Mobile', value : '+66 093 4102002' },
        { icon: "cil-envelope-closed", title : 'E-Mail', value : 'saksith.rit@mfu.ac.th' },
        { icon: "cil-people", title : 'Genger', value : 'Male' },
        { icon: "cil-calendar", title : 'Date of Birth', value : '+66 093 4102002' },
        { icon: "cil-location-pin", title : 'Address', value : '406, M' }
      ],
      link : {
        facebook : 'xxxx',
        instagram : 'xxxx',
        google : 'xxxx'
      }
    }
  },

  mounted () {
  },

  created () {
    this.onInit()

  },
  beforeDestroy () {

  },

  methods: {
    onInit(){

    },

    uploadImage(e) {
      this.image = e.target.files[0];
      const image = e.target.files[0];
      const reader = new FileReader();
      reader.readAsDataURL(image);
      reader.onload = e => {
        this.url = e.target.result;
        this.uploadImageState = true;
      };
    },
  },



  computed:{
    ...mapGetters({
      lang : "setting/lang",
    }),
  },

  watch: {

  }

}
</script>
<style >
.image-bw{
  filter: grayscale(1) contrast(1.5) brightness(1);
}

.animateds{
  animation: 2s ease-in-out 0s infinite normal none running highlight-glow;
  box-shadow: rgba(239, 68, 68, 0.3) 0px 0px 20px, rgba(239, 68, 68, 0.2) 0px 0px 30px, rgba(239, 68, 68, 0.1) 0px 0px 40px;
}
</style>
