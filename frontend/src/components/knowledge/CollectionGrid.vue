<script setup>
import { computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'
import { useAuthStore } from '@/stores/auth'

const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()
const auth = useAuthStore()

const collections = computed(() => knowledgeStore.collections)
const emit = defineEmits(['open', 'edit'])

const getTypeLabel = (type) => {
    switch (type) {
        case 'default': return t('filterAll')
        case 'department': return t('filterDepartment')
        case 'personal': return t('filterPersonal')
        default: return type
    }
}

const getTypeColor = (type) => {
    switch (type) {
        case 'personal': return 'type-personal'
        case 'department': return 'type-department'
        case 'default': return 'type-default'
        default: return 'type-default'
    }
}

const getItemCount = (col) => {
    return col.knowledgeIds?.length || col.knowledgeCount || 0
}

const canManage = (col) => {
    if (col.type === 'personal') return col.ownerId === auth.userId
    if (col.type === 'department') return auth.role === 'admin' && auth.user?.department === col.department
    if (col.type === 'default') return auth.role === 'admin'
    return false
}
</script>

<template>
  <div class="collection-grid">
    <TransitionGroup name="card-list">
      <div v-for="col in collections" :key="col._id" class="collection-card" :class="getTypeColor(col.type)" @click="$emit('open', col)">
        <div class="card-header">
            <div class="folder-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div class="card-type" :class="getTypeColor(col.type)">{{ getTypeLabel(col.type) }}</div>
        </div>
        <div class="card-body">
            <h3>{{ col.name }}</h3>
            <p class="desc">{{ col.description || t('collectionNoDesc') }}</p>
            <div class="meta">
                <span v-if="col.department" class="meta-dept">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/></svg>
                  {{ col.department }}
                </span>
                <span class="meta-count">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {{ getItemCount(col) }} {{ t('collectionItemCount') }}
                </span>
            </div>
        </div>
        <div class="card-footer">
            <button class="btn-outline" @click.stop="$emit('open', col)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              {{ t('openBtn') }}
            </button>
            <button 
                v-if="canManage(col)"
                class="btn-icon" 
                @click.stop="$emit('edit', col)"
                :title="t('editCollection')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
        </div>
      </div>
    </TransitionGroup>
    
    <div v-if="collections.length === 0" class="empty-col">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/>
            <line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
        </div>
        <p class="empty-title">{{ t('noCollectionsFound') }}</p>
        <p class="empty-desc">{{ t('noCollectionsHint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.collection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    gap: 20px;
}

/* Card list transition */
.card-list-enter-active { transition: all 0.3s ease-out; }
.card-list-leave-active { transition: all 0.2s ease-in; }
.card-list-enter-from { opacity: 0; transform: translateY(12px) scale(0.97); }
.card-list-leave-to { opacity: 0; transform: scale(0.95); }

.collection-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 18px;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    position: relative;
}

.collection-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px -8px rgba(0,0,0,0.25);
}

.collection-card.type-personal:hover { border-color: rgba(99,102,241,0.4); }
.collection-card.type-department:hover { border-color: rgba(245,158,11,0.4); }
.collection-card.type-default:hover { border-color: rgba(34,197,94,0.4); }

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.folder-icon {
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
}

.collection-card.type-personal .folder-icon { color: #6366f1; }
.collection-card.type-department .folder-icon { color: #d97706; }
.collection-card.type-default .folder-icon { color: #16a34a; }

.card-type {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    letter-spacing: 0.3px;
}

.card-type.type-personal {
    background: rgba(99,102,241,0.12);
    color: #818cf8;
}
.card-type.type-department {
    background: rgba(245,158,11,0.12);
    color: #d97706;
}
.card-type.type-default {
    background: rgba(34,197,94,0.12);
    color: #16a34a;
}

h3 {
    margin: 0 0 6px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.desc {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0 0 12px 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-style: italic;
}

.meta {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.meta-dept, .meta-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.card-footer {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.btn-outline {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 7px 8px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s ease;
}

.btn-outline:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
    color: var(--color-accent);
}

.btn-icon {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    width: 34px;
    height: 34px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    transition: all 0.2s ease;
}

.btn-icon:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
    color: var(--color-accent);
}

.empty-col {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 40px;
    color: var(--color-text-muted);
    border: 2px dashed var(--color-border);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.empty-icon {
    opacity: 0.4;
    margin-bottom: 8px;
}

.empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
}

.empty-desc {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0;
}
</style>
