<template>
  <div>

    <CCard  class="bg-style2">
      <CCardHeader class="bg-gradient-danger text-white" style="border-top-left-radius: 1rem; border-top-right-radius: 1rem ">
        <span class="font-weight-bold h6"><CIcon :name="icon" size="lg"/> QRCode </span>

<!--        <div class="card-header-actions">-->
<!--          <CButton @click="downloadQr2" class="mr-1" v-c-tooltip.hover.click="'Download'" size="sm" color="success" shape="pill"  >-->
<!--            <CIcon name="cil-cloud-download" />-->
<!--          </CButton>-->
<!--        </div>-->

      </CCardHeader>
      <CCardBody >

        <CRow>
          <CCol class="text-center" id="qr-code">
            <div class="qrcode-wrapper">
              <qr-code id="qr-code" :text="messages" :size="200" level="H" render-as="canvas" />
              <img class="logo" src="@/assets/logo.svg" alt="logo" />
            </div>
          </CCol>
        </CRow>
        <CRow>
          <CCol class="text-center">
            <label class="h4 font-weight-bold">{{ labels }}</label>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>

  </div>
</template>

<script>

export default {
  name: 'QRCodes',
  props: {
    messages: {
      type: String,
      default: ' Campus '
    },
    icon: {
      type: String,
      default: 'cil-qr-code'
    },

    labels: {
      type: String,
      default: "MFU"
    },
  },

  data() {
    return {

    };
  },

  methods: {


    downloadQr2 () {

      // const canvas = document.getElementById("qr-code")
      // if (!canvas) {
      //   console.error("QR is not canvas!")
      //   return
      // }
      // const link = document.createElement("a")
      // link.href = canvas.toDataURL("image/png")
      // link.download = "qrcode.png"
      // link.click()


      const link = document.createElement('a')
      link.download = 'ssssss.png'
      link.href = document.getElementById('qr-code').childNodes[0].toDataURL()
      link.click()
    },

  },
};
</script>

<style scoped>
.qrcode-wrapper {
  position: relative;
  display: inline-block;
}

.qrcode-wrapper .logo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 50px;
  height: 50px;
  transform: translate(-50%, -50%);
  border-radius: 50%;       /* มุมโค้งของโลโก้ */
  background: #8c1515;         /* พื้นหลังป้องกัน QR กลืนโลโก้ */
  padding: 2px;              /* เว้นขอบรอบ ๆ โลโก้ */
  border: 3px solid #8c1515;    /* เส้นรอบโลโก้ (สีดำ) */
  box-shadow: 0 0 6px rgba(0,0,0,0.3); /* เพิ่มเงาเล็กน้อย */
}
</style>
