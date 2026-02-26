<script setup>
import { computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'
import { useAuthStore } from '@/stores/auth'

const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()
const auth = useAuthStore()

const collections = computed(() => knowledgeStore.collections)
const emit = defineEmits(['open', 'edit', 'delete'])

const getTypeLabel = (type) => {
    switch (type) {
        case 'default': return t('filterPublic')
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
    if (auth.role === 'superadmin') return true
    if (col.type === 'personal') return col.ownerId === auth.userId
    if (col.type === 'department') return auth.role === 'admin' && auth.department === col.department
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button 
                v-if="canManage(col)"
                class="btn-icon btn-icon-danger" 
                @click.stop="$emit('delete', col)"
                :title="t('deleteBtn')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
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

/* personal=purple · department=blue · default(public)=green */
.collection-card.type-personal:hover   { border-color: rgba(139,92,246,0.4);  }
.collection-card.type-department:hover { border-color: rgba(59,130,246,0.4);  }
.collection-card.type-default:hover    { border-color: rgba(16,185,129,0.4);  }

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

.collection-card.type-personal .folder-icon   { color: #8b5cf6; }
.collection-card.type-department .folder-icon { color: #3b82f6; }
.collection-card.type-default .folder-icon    { color: #10b981; }

.card-type {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    letter-spacing: 0.3px;
}

.card-type.type-personal   { background: rgba(139,92,246,0.12); color: #8b5cf6; }
.card-type.type-department { background: rgba(59,130,246,0.12);  color: #3b82f6; }
.card-type.type-default    { background: rgba(16,185,129,0.12);  color: #10b981; }

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

.btn-icon-danger:hover {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
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
