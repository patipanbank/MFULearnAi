<template>
  <div class="c-app flex-row align-items-center">
    <CContainer>
      <CRow class="justify-content-center">
        <CCol md="8">
          <CCardGroup>
            <CCard class="p-4">
              <CCardBody>
                <CForm @submit.prevent="login">
                  <img src="@/assets/logo.svg" height="150px" class="mb-4"/>
                  <h1>Login</h1>
                  <p class="text-muted">Sign In to your account</p>
                  
                  <CInput
                    placeholder="Username"
                    autocomplete="username"
                    v-model="username"
                  >
                    <template #prepend-content><CIcon name="cil-user"/></template>
                  </CInput>
                  
                  <CInput
                    placeholder="Password"
                    type="password"
                    autocomplete="current-password"
                    v-model="password"
                  >
                    <template #prepend-content><CIcon name="cil-lock-locked"/></template>
                  </CInput>

                  <CRow>
                    <CCol col="6" class="text-left">
                      <CButton color="primary" class="px-4" type="submit">Login</CButton>
                    </CCol>
                    <CCol col="6" class="text-right">
                      <CButton color="link" class="px-0">Forgot password?</CButton>
                    </CCol>
                  </CRow>

                  <hr class="my-4"/>
                  
                  <div class="text-center">
                    <p>Or sign in with</p>
                    <CButton 
                      color="danger" 
                      class="mr-2"
                      @click="loginGoogle"
                    >
                      <CIcon name="cib-google" class="mr-2"/> Google
                    </CButton>
                    <CButton 
                      color="info"
                      @click="loginSaml"
                    >
                      <CIcon name="cil-institution" class="mr-2"/> MFU Login (SAML)
                    </CButton>
                  </div>

                </CForm>
              </CCardBody>
            </CCard>
          </CCardGroup>
        </CCol>
      </CRow>
    </CContainer>
  </div>
</template>

<script>
import { mapActions } from 'vuex'

export default {
  name: 'Login',
  data() {
    return {
      username: '',
      password: ''
    }
  },
  methods: {
    ...mapActions('auth', ['signIn']), // Maps this.signIn() to store.dispatch('auth/signIn')
    
    login() {
      if (!this.username || !this.password) {
        alert('Please enter username and password');
        return;
      }
      this.signIn({ 
        email: this.username, 
        password: this.password 
      });
    },
    
    loginGoogle() {
      window.location.href = '/api/auth/login/google';
    },
    
    loginSaml() {
      window.location.href = '/api/auth/login/saml';
    }
  }
}
</script>
