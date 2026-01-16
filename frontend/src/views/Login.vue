<script setup>
</script>

<template>
  <div class="bg-light min-vh-100 d-flex flex-row align-items-center">
    <CContainer>
      <CRow class="justify-content-center">
        <CCol :md="8">
          <CCardGroup>
            <CCard class="p-4">
              <CCardBody>
                <CForm>
                  <h1>Login</h1>
                  <p class="text-medium-emphasis">Sign in to your account</p>
                  
                  <div class="d-grid gap-2 col-12 mx-auto mt-4">
                    <a href="/api/auth/login/google" class="btn btn-danger text-white">
                       Login with Google
                    </a>
                    <a href="/api/auth/login/saml" class="btn btn-info text-white">
                       Login with MFU Account
                    </a>
                  </div>

                  <div class="mt-4 text-center">
                    <small>By logging in, you agree to our Terms and PDPA Policy.</small>
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
