<template>
  <div>
    <CModal
        add-content-classes="bg-login"
        :show.sync="is2FA"
        centered
    >
      <template #header-wrapper>
        <div class="mb-4"></div>
      </template>

      <template #body-wrapper>
        <CRow class="justify-content-center text-white">
          <CCol col="8">
            <CForm @submit.prevent="onSubmitCode">
              <div class="text-center mb-3">
                <img src="@/assets/logo.svg" height="100px" />
              </div>

              <div class="text-center">
                <p class="h4 font-weight-bold mb-2">Authentication Your Account</p>
                <p>Protecting your tickets is our top priority.</p>
                <p>Please confirm your account by entering the authorization code sent to:</p>
                <p><strong>E-mail:</strong> saksith.rit@mfu.ac.th</p>
              </div>

              <!-- OTP Input -->
              <div class="otp-wrapper mt-4">
                <div
                    v-for="(digit, index) in otpInputs"
                    :key="index"
                    class="otp-input"
                >
                  <input
                      v-model="otpInputs[index]"
                      type="text"
                      maxlength="1"
                      @input="onInput(index)"
                      @keydown.backspace="onBackspace(index)"
                      ref="otpRefs"
                  />
                </div>
              </div>

              <CRow class="mt-4 text-center">
                <CCol>
                  <p class="p-0 m-0">it may take a minute to receive your code</p>
                  <p class="p-0 m-0">Hoven't receieved it? <span class="text-info"  style="cursor: pointer">Resend a new code</span></p>
                </CCol>
<!--                <CCol col="5" class="text-right">-->
<!--                  <CButton class=""   shape="pill" variant="outline"  color="danger">-->
<!--                    <span class="font-weight-bold mr-1 pl-1 pr-1">-->
<!--                      <CIcon name="cil-save" size="lg"/> SUBMIT-->
<!--                    </span>-->
<!--                  </CButton>-->
<!--                </CCol>-->
              </CRow>
            </CForm>
          </CCol>
        </CRow>
      </template>

      <template #footer-wrapper>
        <div class="mb-4"></div>
      </template>
    </CModal>
  </div>
</template>

<script>
import {mapGetters} from "vuex";

export default {
  name: 'TwoFA',
  data() {
    return {
      otpLength: 6, // ✅ เปลี่ยนจำนวนช่อง OTP ได้ที่นี่
      otpInputs: [],
    }
  },
  mounted() {
    this.otpInputs = Array(this.otpLength).fill('')
  },

  created() {

    // this.$store.dispatch("auth/twofa",{})
  },

  beforeDestroy() {

  },
  methods: {
    onInput(index) {
      const input = this.otpInputs[index]
      // ✅ รับเฉพาะ a-z, A-Z, 0-9
      if (!/^[a-zA-Z0-9]$/.test(input)) {
        this.$set(this.otpInputs, index, '')
        return
      }
      // 🔁 move focus ถัดไป
      if (index < this.otpLength - 1) {
        this.$refs.otpRefs[index + 1].focus()
      }
    },
    onBackspace(index) {
      if (this.otpInputs[index] === '' && index > 0) {
        this.$refs.otpRefs[index - 1].focus()
      }
    },
    onSubmitCode() {
      const code = this.otpInputs.join('')
      if (code.length === this.otpLength) {
        console.log('✅ OTP entered:', code)
        alert(`OTP entered: ${code}`)
      } else {
        alert(`Please enter all ${this.otpLength} characters`)
      }
    },
  },

  computed: {
    ...mapGetters({
      is2FA: 'auth/is2FA',
    })
  },

  watch: {
    otpInputs: function (value) {
      if(value.every(v => v !== "" && v != null) === true){
        var body = {};
        body.code = value.join("");
        this.$store.dispatch("auth/twofaSend",body)
      }
    },

  }
}
</script>

<style scoped>
.otp-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.otp-input input {
  width: 50px;
  height: 50px;
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
  border: 2px solid #ccc;
  border-radius: 8px;
  transition: all 0.2s ease;
  //text-transform: uppercase; /* ทำให้ตัวอักษรเป็นตัวใหญ่ */
}

.otp-input input:focus {
  border-color: #007bff;
  box-shadow: 0 0 5px rgba(0, 123, 255, 0.4);
  outline: none;
}
</style>
