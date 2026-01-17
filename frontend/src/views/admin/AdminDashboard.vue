<template>
  <div class="page-container">
    <div class="content-wrapper">
      <div class="header">
        <h1>Admin Dashboard</h1>
        <p class="subtitle">System settings and user management</p>
      </div>
      
      <div class="placeholder-content">
        <div class="empty-state">
          <div class="icon">⚙️</div>
          <h3>System Administration</h3>
          <p>Configure system preferences and manage access.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  height: 100%;
  width: 100%;
  padding: 24px;
  overflow-y: auto;
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 32px;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0 0 8px 0;
}

.subtitle {
  color: #94a3b8;
  font-size: 16px;
}

.placeholder-content {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid #334155;
  border-radius: 12px;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  text-align: center;
}

.icon {
  font-size: 48px;
  margin-bottom: 16px;
}

h3 {
  color: #e2e8f0;
  font-size: 20px;
  margin-bottom: 8px;
}

p {
  color: #64748b;
}
</style>
