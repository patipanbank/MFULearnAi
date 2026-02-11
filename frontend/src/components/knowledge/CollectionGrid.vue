<script setup>
import { computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()

const collections = computed(() => knowledgeStore.collections)
const emit = defineEmits(['open', 'edit'])

const getTypeLabel = (type) => {
    switch (type) {
        case 'default': return 'Global'
        case 'department': return 'Department'
        case 'personal': return 'Private'
        default: return type
    }
}

const canManage = (col) => {
    // console.log('Checking permission:', col.name, col.ownerId, auth.userId)
    if (col.type === 'personal') return col.ownerId === auth.userId
    if (col.type === 'department') return auth.role === 'admin' && auth.user?.department === col.department
    if (col.type === 'default') return auth.role === 'admin' // Only admins map to global
    return false
}
</script>

<template>
  <div class="collection-grid">
    <div v-for="col in collections" :key="col._id" class="collection-card" @click="$emit('open', col)">
       <div class="card-header">
           <div class="folder-icon">📁</div>
           <div class="card-type">{{ getTypeLabel(col.type) }}</div>
       </div>
       <div class="card-body">
           <h3>{{ col.name }}</h3>
           <p class="desc">{{ col.description || 'No description' }}</p>
           <div class="meta">
               <span>{{ col.department }}</span>
           </div>
       </div>
       <div class="card-footer">
           <button class="btn-outline">Open</button>
            <button 
                v-if="canManage(col)"
                class="btn-icon" 
                @click.stop="$emit('edit', col)"
            >
                ⚙️
            </button>
       </div>
    </div>
    
    <div v-if="collections.length === 0" class="empty-col">
        No collections found.
    </div>
  </div>
</template>

<style scoped>
.collection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
}

.collection-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    transition: transform 0.2s, box-shadow 0.2s;
}

.collection-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.folder-icon {
    font-size: 24px;
}

.card-type {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
}

h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    color: var(--color-text-primary);
}

.desc {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0 0 12px 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.meta {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 16px;
}

.card-footer {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.btn-outline {
    flex: 1;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
}

.btn-outline:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
}

.btn-icon {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    width: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-col {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px;
    color: var(--color-text-muted);
    border: 2px dashed var(--color-border);
    border-radius: 12px;
}
</style>
