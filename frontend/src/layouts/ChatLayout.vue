const router = useRouter() // Import useRouter if not already
// ... (imports)

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

// ...

    <AppHeader 
        :env-name="envName"
        :user-name="userName"
        :user-initial="userInitial"
        :user-avatar-url="authStore.profilePicture"
        :user-role="authStore.role"
        :user-department="authStore.department"
        :user-email="authStore.user?.email"
        :show-sidebar-toggle="isMobile"
        @toggle-sidebar="toggleSidebar"
        @logout="handleLogout"
      />
      <div class="content-view">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-layout-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}

.chat-main-content {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: visible;
  position: relative;
  display: flex;
  flex-direction: column;
}

.content-view {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* Mobile Backdrop */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 45; /* Below sidebar (50) but above content */
  backdrop-filter: blur(2px);
}
</style>
