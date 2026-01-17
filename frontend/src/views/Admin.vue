<template>
  <div class="admin-placeholder">
    <div class="card">
      <div class="icon">⚙️</div>
      <h2>Admin Dashboard</h2>
      <p>System configuration and user management controls will appear here.</p>
      <span class="badge">Admin Access Only</span>
    </div>
  </div>
</template>

<style scoped>
.admin-placeholder {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  padding: 24px;
}

.card {
  max-width: 400px;
  padding: 48px;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 16px;
  text-align: center;
}

.icon {
  font-size: 48px;
  margin-bottom: 16px;
}

h2 {
  color: #f1f5f9;
  margin-bottom: 12px;
  font-size: 24px;
}

p {
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 24px;
}

.badge {
  display: inline-block;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #f87171;
  font-size: 12px;
  font-weight: 500;
}
</style>
