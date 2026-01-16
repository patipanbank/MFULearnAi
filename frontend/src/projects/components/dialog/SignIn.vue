<template>
    <div>
        <CModal
            add-content-classes="bg-login"
            :show.sync="isAuthe"
            :centered="true"
            :close-on-backdrop="true"
        >
          <template #header-wrapper>
            <div class="mb-5"></div>
          </template>
          <template #body-wrapper>
            <CRow class="justify-content-center ">
              <CCol col="8">
                <CForm >
                  <CRow >
                    <CCol class="text-center">
                      <img src="@/assets/logo.svg" height="150px"/>
                    </CCol>
                  </CRow>

                  <CRow class=" mt-2">
                    <CCol>
                      <p class="font-weight-bold">1 Contact</p>
                      <p>ส่วนการเจ้าหน้าที่ (Personnel Division) Tel 0-5391-6494 , 6053  E-mail: personnel@mfu.ac.th</p>


                      <p class="font-weight-bold">2. คู่มือสมรรถนะ (Competency Dictionary) </p>
                      <span>Thai Version  "Click Here" <a class="font-weight-bold" target="_blank" href="https://drive.google.com/file/d/1obIc3c5kEJ6nP1rBH5uA9nvw62fjzTid/view?usp=sharing ">"Click Here"</a></span> <br>
                      <span> English Version "Click Here"<a class="font-weight-bold" target="_blank" href="https://drive.google.com/file/d/1Ds3wv_QlPoA_M10i2snrzrh5Ri_Qi9wQ/view?usp=sharing ">"Click Here"</a></span>

                      <p class="font-weight-bold mt-4">3. คู่มือการใช้งานระบบ (User Manual) </p>
                      <span>Thai Version  "Click Here" <a class="font-weight-bold" target="_blank" href="https://drive.google.com/file/d/1YJxsIbrhgp9tsfz-neHuEDC39mgUpWqg/view?usp=sharing">"Click Here"</a></span> <br>
                      <span> English Version "Click Here" <a class="font-weight-bold" target="_blank" href="https://drive.google.com/file/d/1dGYb9s9X1WVuPwEWW3xaScCUEsODxwkA/view?usp=sharing">"Click Here"</a></span>


                      <p class="font-weight-bold mt-4">4.แจ้งปัญหาการเข้าใช้ระบบ Usage Issue Reporting Form <a class="font-weight-bold" target="_blank" href="https://docs.google.com/forms/d/e/1FAIpQLSec2LSaDE1flmQULhl7bsCbTOZl4nd1VGfSv3LDxP7bnuZ9iQ/viewform ">"Click Here"</a></p>

                    </CCol>
                  </CRow>

                  <CRow>
                    <CCol>
                      <CDropdownDivider class="mt-2"/>
                    </CCol>
                    <label class="text-dark font-weight-bold"> SIGN IN WITH SOCIAL </label>
                    <CCol>
                      <CDropdownDivider class="mt-2"/>
                    </CCol>
                  </CRow>
                  <CRow>
                    <CCol class="text-center">
                      <div style="cursor: pointer">
<!--                        <img class="mr-2 zoom" src="@/assets/icons/logo-facebook.png" width="50px"/>-->
                        <img class="zoom" @click="onAuthenGoogle" src="@/assets/icons/logo-google.png" width="50px"/>
<!--                        <CButton color="danger" @click="onAuthenGoogle" shape="pill" >-->
<!--                          <samp class="pl-2 pr-2">Login with MFU Mail</samp>-->
<!--                        </CButton>-->

                      </div>
                    </CCol>
                  </CRow>
                </CForm>
              </CCol>
            </CRow>
          </template>
          <template #footer-wrapper>
            <div class="mb-5"></div>
          </template>
        </CModal>
    </div>
</template>

<script>

    import {mapGetters} from 'vuex'

    export default {
        name: 'SignIn',
        data: function () {
            return {
              oAuth2: true,

              typePassword:"password",
              onOpenForgotPassword:true,
              username:"",
              password:"",
              email:""
            }
        },
        mounted() {

        },

        created() {
        },

        beforeDestroy() {

        },

        methods: {

          onViewPassword(){
            if(this.typePassword == "password"){
              this.typePassword = "text";
            }else{
              this.typePassword = "password";
            }
          },

          onOpenForgotPasswords(){

            this.onOpenForgotPassword = !this.onOpenForgotPassword;
          },

          onForgotPassword(){

          },
          onOpenSignIn(){
            var body = {}
            body.username = this.username;
            body.password = this.password;
            this.$store.dispatch("auth/onLogin", body);
          },

          async onAuthenGoogle() {
            try {
              console.log("onAuthenGoogle")
              const googleUser = await this.$gAuth.signIn();
              // const profile = googleUser.getBasicProfile();
              // const id_token = googleUser.getAuthResponse().id_token;
              // console.log('User:', profile);
              console.log('googleUser', googleUser)

              // var body = {}
              // body.token = id_token
              // this.$store.dispatch("auth/singin", body)

            } catch (err) {
              console.error('Google sign-in error:', err);
              this.$toast?.error('Google Sign-In failed. Please try again.');
            }
          },

          onOpenSignUp(){
            this.$store.commit("auth/isSignIn", false);
          },

          handleOnComplete(value) {
            console.log('OTP completed: ', value);
          },
          handleOnChange(value) {
            console.log('OTP changed: ', value);
          },
          handleClearInput() {
            this.$refs.otpInput.clearInput();
          },

        },

        computed: {
            ...mapGetters({
              isAuthe: 'auth/isSignIn'
            })
        },

        watch: {


          // isAuthe: function (value) {
          //   this.onOpenForgotPassword =true;
          //   this.$store.commit("auth/isSignIn", value)
          // },
        }
    }
</script>

<style>
</style>
