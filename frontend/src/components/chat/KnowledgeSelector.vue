<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()
const { t, lang } = useLanguage()

const isOpen = ref(false)
const searchQuery = ref('')
const dropdownRef = ref(null)
const dropdownPosition = reactive({ top: 0, left: 0, maxHeight: 400 })

// ── Current selection ──
const currentCollection = computed(() =>
  knowledgeStore.collections.find(c => c._id === chatStore.currentCollectionId) || null
)

const currentName = computed(() => {
  if (!currentCollection.value) return t('defaultCollection')
  return currentCollection.value.name
})

const mobileName = computed(() => {
  if (!currentCollection.value) return lang.value === 'th' ? 'ค่าเริ่มต้น' : 'Default'
  const n = currentCollection.value.name
  return n.length > 12 ? n.slice(0, 10) + '…' : n
})

const collectionType = computed(() => currentCollection.value?.type || 'default')

// ── Filter ──
const filteredCollections = computed(() => {
  let list = knowledgeStore.collections.filter(c => c.name !== 'Default Collection')
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.type?.toLowerCase().includes(q)
    )
  }
  return list
})

// ── Dropdown positioning ──
const updatePosition = () => {
  if (!dropdownRef.value) return
  const rect = dropdownRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom

  dropdownPosition.top = rect.bottom + 6
  dropdownPosition.left = rect.left

  if (dropdownPosition.left + 320 > window.innerWidth) {
    dropdownPosition.left = window.innerWidth - 328
  }
  dropdownPosition.maxHeight = Math.min(spaceBelow - 16, 380)
}

const toggleDropdown = async () => {
  if (!isOpen.value) {
    isOpen.value = true
    searchQuery.value = ''
    await nextTick()
    updatePosition()
    document.getElementById('ks-search')?.focus()
  } else {
    isOpen.value = false
  }
}

const selectCollection = (id) => {
  chatStore.currentCollectionId = id
  isOpen.value = false
}

const closeDropdown = () => { isOpen.value = false }

const onScrollResize = () => { if (isOpen.value) updatePosition() }

onMounted(() => {
  window.addEventListener('resize', onScrollResize)
  window.addEventListener('scroll', onScrollResize, true)
})
onUnmounted(() => {
  window.removeEventListener('resize', onScrollResize)
  window.removeEventListener('scroll', onScrollResize, true)
})

// ── Helpers ──
const typeIcon = (type) => ({
  personal: 'user', department: 'building', public: 'book', default: 'globe'
}[type] || 'book')

const typeColor = (type) => ({
  personal: 'icon-personal', department: 'icon-dept',
  public: 'icon-public', default: 'icon-default'
}[type] || 'icon-public')
</script>

<template>
  <div class="ks-root" ref="dropdownRef">

    <!-- Trigger -->
    <button
      class="ks-trigger"
      :class="{ open: isOpen }"
      @click.stop="toggleDropdown"
    >
      <!-- Type icon -->
      <div class="trigger-icon" :class="typeColor(collectionType)">
        <svg v-if="typeIcon(collectionType) === 'globe'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <svg v-else-if="typeIcon(collectionType) === 'user'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <svg v-else-if="typeIcon(collectionType) === 'building'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="6" x2="12" y2="6.01"/>
          <line x1="12" y1="10" x2="12" y2="10.01"/><line x1="12" y1="14" x2="12" y2="14.01"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      </div>

      <!-- Label -->
      <span class="trigger-label desktop-only">{{ currentName }}</span>
      <span class="trigger-label mobile-only">{{ mobileName }}</span>

      <!-- Chevron -->
      <svg class="trigger-chevron" :class="{ rotated: isOpen }"
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- Dropdown (Teleported) -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div v-if="isOpen" class="ks-overlay">
          <div class="ks-backdrop" @click="closeDropdown" />

          <div
            class="ks-dropdown"
            :style="{
              top: dropdownPosition.top + 'px',
              left: dropdownPosition.left + 'px',
              maxHeight: dropdownPosition.maxHeight + 'px'
            }"
          >
            <!-- Header -->
            <div class="dd-header">{{ t('selectContext') }}</div>

            <!-- Search -->
            <div class="dd-search">
              <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                id="ks-search"
                v-model="searchQuery"
                type="text"
                placeholder="Filter collections..."
                class="search-input"
                @click.stop
              />
              <button v-if="searchQuery" class="search-clear" @click.stop="searchQuery = ''">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- List -->
            <div class="dd-list">

              <!-- Default option -->
              <button
                v-if="!searchQuery || 'default'.includes(searchQuery.toLowerCase())"
                class="dd-item"
                :class="{ selected: !chatStore.currentCollectionId }"
                @click="selectCollection(null)"
              >
                <div class="item-icon icon-default">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </div>
                <div class="item-body">
                  <span class="item-name">{{ t('defaultCollection') }}</span>
                  <span class="item-type">General knowledge base</span>
                </div>
                <svg v-if="!chatStore.currentCollectionId" class="item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>

              <div v-if="!searchQuery" class="dd-divider" />

              <!-- Dynamic collections -->
              <template v-if="filteredCollections.length > 0">
                <button
                  v-for="col in filteredCollections"
                  :key="col._id"
                  class="dd-item"
                  :class="{ selected: chatStore.currentCollectionId === col._id }"
                  @click="selectCollection(col._id)"
                >
                  <div class="item-icon" :class="typeColor(col.type)">
                    <svg v-if="col.type === 'personal'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <svg v-else-if="col.type === 'department'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="4" y="2" width="16" height="20" rx="2"/>
                      <line x1="12" y1="6" x2="12" y2="6.01"/><line x1="12" y1="10" x2="12" y2="10.01"/>
                      <line x1="12" y1="14" x2="12" y2="14.01"/><line x1="8" y1="10" x2="8" y2="10.01"/>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                  <div class="item-body">
                    <span class="item-name">{{ col.name }}</span>
                    <span class="item-type capitalize">{{ col.type }} collection</span>
                  </div>
                  <svg v-if="chatStore.currentCollectionId === col._id" class="item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              </template>

              <!-- Empty states -->
              <div v-else-if="searchQuery" class="dd-empty">
                No results for "{{ searchQuery }}"
              </div>
              <div v-else class="dd-empty">No collections available</div>

            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Root ── */
.ks-root { position: relative; }

/* ── Trigger ── */
.ks-trigger {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px 5px 5px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 99px;
  cursor: pointer; color: var(--color-text-primary);
  max-width: 220px; min-width: 0;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.ks-trigger:hover, .ks-trigger.open {
  background: var(--color-bg-tertiary);
  border-color: var(--color-accent, #6366f1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent, #6366f1) 10%, transparent);
}

.trigger-icon {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.trigger-label {
  font-size: 13px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1; min-width: 0;
}

.trigger-chevron {
  flex-shrink: 0; color: var(--color-text-muted);
  transition: transform 0.2s ease;
}
.trigger-chevron.rotated { transform: rotate(180deg); }

/* ── Mobile/Desktop label toggle ── */
.mobile-only { display: none; }
.desktop-only { display: block; }
@media (max-width: 1024px) {
  .mobile-only { display: block; }
  .desktop-only { display: none; }
  .ks-trigger { max-width: 160px; }
}
@media (max-width: 640px) {
  .ks-trigger { max-width: none; width: 100%; }
}

/* ── Icon color variants ── */
.icon-default  { background: rgba(34,197,94,0.12);  color: #16a34a; }
.icon-personal { background: rgba(99,102,241,0.12); color: #6366f1; }
.icon-dept     { background: rgba(245,158,11,0.12); color: #d97706; }
.icon-public   { background: rgba(100,116,139,0.1); color: var(--color-text-secondary); }

/* ── Overlay / Backdrop ── */
.ks-overlay {
  position: fixed; inset: 0; z-index: 9999;
  pointer-events: none;
}
.ks-backdrop {
  position: absolute; inset: 0;
  pointer-events: auto;
}

/* ── Dropdown ── */
.ks-dropdown {
  position: fixed;
  width: 300px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 8px 32px -4px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.1);
  overflow: hidden;
  pointer-events: auto;
  display: flex; flex-direction: column;
}

/* Dropdown transition */
.dropdown-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0; transform: translateY(-6px) scale(0.98);
}

.dd-header {
  padding: 10px 14px;
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.6px;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* Search */
.dd-search {
  display: flex; align-items: center; gap: 0;
  padding: 8px 10px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0; position: relative;
}
.search-icon {
  position: absolute; left: 22px;
  color: var(--color-text-muted); pointer-events: none;
}
.search-input {
  flex: 1; padding: 6px 28px 6px 28px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px; color: var(--color-text-primary);
  outline: none; transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
}
.search-input:focus {
  border-color: var(--color-accent, #6366f1);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent, #6366f1) 12%, transparent);
}
.search-clear {
  position: absolute; right: 18px;
  width: 20px; height: 20px; border-radius: 50%;
  background: transparent; border: none;
  color: var(--color-text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.search-clear:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

/* List */
.dd-list {
  overflow-y: auto; padding: 6px;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
.dd-list::-webkit-scrollbar { width: 4px; }
.dd-list::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }

.dd-divider { height: 1px; background: var(--color-border); margin: 4px 8px; }

.dd-item {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 10px;
  border: 1px solid transparent; background: transparent;
  cursor: pointer; text-align: left;
  transition: background 0.12s, border-color 0.12s;
}
.dd-item:hover { background: var(--color-bg-tertiary); }
.dd-item.selected {
  background: color-mix(in srgb, var(--color-accent, #6366f1) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-accent, #6366f1) 20%, transparent);
}

.item-icon {
  width: 34px; height: 34px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.item-body { flex: 1; min-width: 0; }
.item-name {
  display: block; font-size: 13px; font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.item-type { display: block; font-size: 11px; color: var(--color-text-muted); margin-top: 1px; }

.item-check { color: var(--color-accent, #6366f1); flex-shrink: 0; }

.dd-empty {
  padding: 16px; text-align: center;
  font-size: 12px; color: var(--color-text-muted);
  font-style: italic;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .ks-dropdown {
    width: 88vw; max-width: 300px;
    left: 50% !important;
    transform: translateX(-50%) !important;
  }
}
</style>