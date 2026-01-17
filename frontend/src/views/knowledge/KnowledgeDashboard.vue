<template>
  <div class="page-container">
    <div class="content-wrapper">
      <div class="header">
        <h1>Knowledge Base</h1>
        <p class="subtitle">Manage your AI's knowledge sources and collections</p>
      </div>
      
      <div class="placeholder-content">
        <div class="empty-state">
          <div class="icon">📚</div>
          <h3>Knowledge Dashboard</h3>
          <p>Select a collection or document to view details.</p>
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
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 16px;
}

.placeholder-content {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
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
  color: var(--color-text-primary);
  font-size: 20px;
  margin-bottom: 8px;
}

p {
  color: var(--color-text-secondary);
}
</style>
