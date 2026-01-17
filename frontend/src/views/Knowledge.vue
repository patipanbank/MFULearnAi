<template>
  <div class="knowledge-placeholder">
    <div class="card">
      <div class="icon">📚</div>
      <h2>Knowledge Base</h2>
      <p>Coming soon. We're building a new way to manage your AI's intelligence.</p>
      <span class="badge">Work in Progress</span>
    </div>
  </div>
</template>

<style scoped>
.knowledge-placeholder {
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
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  color: #60a5fa;
  font-size: 12px;
  font-weight: 500;
}
</style>
