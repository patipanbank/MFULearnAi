<template>
  <div class="collection-placeholder">
    <router-link to="/knowledge" class="back-link">
      ← Back to Knowledge
    </router-link>
    <h1>Collection View</h1>
    <p>This view is being updated.</p>
  </div>
</template>

<style scoped>
.collection-placeholder {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  color: #94a3b8;
  padding: 24px;
}

.back-link {
  color: #60a5fa;
  text-decoration: none;
  margin-bottom: 24px;
  font-size: 14px;
}

.back-link:hover {
  text-decoration: underline;
}

h1 {
  color: #f1f5f9;
  margin-bottom: 8px;
}
</style>
