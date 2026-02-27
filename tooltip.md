# แผนการสร้างระบบ Tooltip — MFULearnAI

> วันที่วางแผน: 27 กุมภาพันธ์ 2569  
> ขอบเขต: Frontend (Vue 3 + CSS Custom Properties)

---

## 1. สภาพปัจจุบัน (AS-IS)

| จุด | สิ่งที่มีอยู่ |
|-----|--------------|
| ทั้งระบบ | ใช้ native HTML `title=""` attribute เป็น tooltip เพียงอย่างเดียว |
| ตัวอย่างที่พบ | `TokenUsageBar.vue`, `KnowledgeList.vue`, `AppSidebar.vue`, `Chat.vue` |
| ข้อจำกัด | style ไม่สม่ำเสมอ, ไม่รองรับ dark/light theme, ไม่รองรับ rich content, delay ไม่ได้, ตำแหน่งไม่ยืดหยุ่น |

---

## 2. เป้าหมาย (TO-BE)

- **Tooltip component** ที่ใช้ซ้ำได้ทั่วทั้งระบบ
- รองรับ **dark / light theme** ผ่าน CSS custom properties ที่มีอยู่แล้ว
- รองรับ **4 ทิศทาง**: `top` (default), `bottom`, `left`, `right`
- รองรับ **rich content** ผ่าน slot
- มี **Vue directive** `v-tooltip` สำหรับกรณีข้อความสั้น
- **Composable** `useTooltip()` สำหรับ programmatic control
- **Accessible**: รองรับ ARIA attributes (`role="tooltip"`, `aria-describedby`)
- Delay แสดง/ซ่อนได้ (default: show 200ms, hide 100ms)

---

## 3. ไฟล์ที่ต้องสร้าง / แก้ไข

```
frontend/src/
├── components/
│   └── common/
│       └── Tooltip.vue                  ← NEW (component wrapper)
├── composables/
│   └── useTooltip.js                    ← NEW (programmatic control)
├── directives/
│   └── vTooltip.js                      ← NEW (v-tooltip directive)
├── styles/
│   └── main.css                         ← EDIT (เพิ่ม CSS tooltip global)
└── main.js                              ← EDIT (register directive globally)
```

---

## 4. สถาปัตยกรรมโดยรวม

```
ผู้ใช้ hover / focus
        │
        ▼
┌──────────────────────────────────┐
│  v-tooltip directive             │  ← สำหรับ plain text สั้น ๆ
│  หรือ <Tooltip> component        │  ← สำหรับ rich content / slot
└────────────┬─────────────────────┘
             │ useTooltip composable
             ▼
┌──────────────────────────────────┐
│  Tooltip Portal (teleport body)  │  ← render นอก stacking context
│  - คำนวณตำแหน่ง (getBoundingClientRect)
│  - จัดการ z-index และ offset
│  - animate fade-in / fade-out
└──────────────────────────────────┘
```

---

## 5. รายละเอียดการ Implement

### 5.1 `Tooltip.vue` — Component

**Props:**

| Prop | Type | Default | คำอธิบาย |
|------|------|---------|----------|
| `content` | `String` | `''` | ข้อความ tooltip (ใช้แทน slot ได้) |
| `placement` | `String` | `'top'` | `top` \| `bottom` \| `left` \| `right` |
| `showDelay` | `Number` | `200` | ms ก่อนแสดง |
| `hideDelay` | `Number` | `100` | ms ก่อนซ่อน |
| `disabled` | `Boolean` | `false` | ปิด tooltip ชั่วคราว |
| `maxWidth` | `String` | `'240px'` | ความกว้างสูงสุด |

**Slots:**
- `default` — trigger element
- `content` — rich tooltip content (override `content` prop)

**โครงสร้าง template (สรุป):**
```vue
<template>
  <div class="tooltip-wrapper"
       @mouseenter="scheduleShow"
       @mouseleave="scheduleHide"
       @focusin="scheduleShow"
       @focusout="scheduleHide">
    <slot />
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div v-if="visible"
             class="tooltip-popup"
             :class="`tooltip-popup--${placement}`"
             :style="popupStyle"
             role="tooltip"
             :id="tooltipId">
          <slot name="content">{{ content }}</slot>
          <span class="tooltip-arrow" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
```

**ตรรกะหลัก (script setup):**
```js
// คำนวณตำแหน่งด้วย getBoundingClientRect()
// ใช้ ref สำหรับ wrapperRef เพื่อ getBoundingClientRect
// useId() หรือ nanoid สำหรับ tooltipId
// showTimer / hideTimer สำหรับ delay
// popupStyle computed จาก placement + rect
```

---

### 5.2 `vTooltip.js` — Directive

**การใช้งาน:**
```vue
<!-- plain string -->
<button v-tooltip="'บันทึก'">Save</button>

<!-- object config -->
<button v-tooltip="{ content: 'ลบรายการ', placement: 'bottom' }">Delete</button>
```

**Implementation:**
```js
// directive hooks: mounted, updated, unmounted
// สร้าง tooltip div และ append to body ใน mounted
// คำนวณตำแหน่งใน mouseenter listener
// ลบ element ใน unmounted
```

---

### 5.3 `useTooltip.js` — Composable

**API:**
```js
const { show, hide, toggle, isVisible } = useTooltip(targetRef, options)
```

**ใช้เมื่อ:** ต้องการ trigger tooltip จาก code (เช่น แสดง "Copied!" หลัง copy to clipboard)

---

### 5.4 CSS ที่ต้องเพิ่มใน `main.css`

```css
/* ── Tooltip ──────────────────────────────────── */
.tooltip-popup {
  position: fixed;
  z-index: 9999;
  padding: 6px 10px;
  background: var(--tooltip-bg, #1e293b);
  color: var(--tooltip-text, #f8fafc);
  font-size: 12px;
  line-height: 1.4;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  pointer-events: none;
  white-space: nowrap;
  max-width: var(--tooltip-max-width, 240px);
  white-space: pre-wrap;
}

/* Dark theme override */
[data-theme="dark"] {
  --tooltip-bg: #e2e8f0;
  --tooltip-text: #0f172a;
}

/* Arrow */
.tooltip-arrow {
  position: absolute;
  width: 6px;
  height: 6px;
  background: inherit;
  transform: rotate(45deg);
}

/* Arrow positions per placement */
.tooltip-popup--top    .tooltip-arrow { bottom: -3px; left: 50%; margin-left: -3px; }
.tooltip-popup--bottom .tooltip-arrow { top:    -3px; left: 50%; margin-left: -3px; }
.tooltip-popup--left   .tooltip-arrow { right:  -3px; top:  50%; margin-top:  -3px; }
.tooltip-popup--right  .tooltip-arrow { left:   -3px; top:  50%; margin-top:  -3px; }

/* Transition */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.tooltip-fade-enter-from,
.tooltip-fade-leave-to    { opacity: 0; transform: scale(0.95); }
```

---

### 5.5 Register Directive ใน `main.js`

```js
import { vTooltip } from '@/directives/vTooltip'
app.directive('tooltip', vTooltip)
```

---

## 6. จุดที่ควร Migrate จาก `title=""` → Tooltip

| ไฟล์ | บรรทัดที่ควรแก้ | หมายเหตุ |
|------|----------------|----------|
| `TokenUsageBar.vue` | `title="..."` บน `.token-usage-container` | เปลี่ยนเป็น `v-tooltip` หรือ `<Tooltip>` |
| `AppSidebar.vue` | `title={t('newChat')}` บนปุ่ม new chat | ใช้ `v-tooltip` |
| `KnowledgeList.vue` | ปุ่ม rename, delete, retry, approve, reject | ใช้ `v-tooltip` + placement เหมาะสม |
| `CollectionGrid.vue` | ปุ่ม edit/delete collection | ใช้ `v-tooltip` |
| `CollectionDetailModal.vue` | ปุ่ม header action | ใช้ `v-tooltip` |
| `Chat.vue` | ปุ่ม scroll to bottom | ใช้ `v-tooltip="{ content: ..., placement: 'left' }"` |
| `UploadModal.vue` | icon error status | ใช้ `<Tooltip>` (rich content) |

---

## 7. ลำดับการ Implement (Task Order)

```
[1] สร้าง CSS variables + transition ใน main.css
[2] สร้าง Tooltip.vue component (Teleport + placement logic)
[3] สร้าง vTooltip.js directive
[4] สร้าง useTooltip.js composable
[5] Register directive ใน main.js
[6] Migrate TokenUsageBar.vue (กรณีซับซ้อน — ผลลัพธ์ชัด)
[7] Migrate ปุ่มใน KnowledgeList.vue
[8] Migrate AppSidebar.vue, CollectionGrid.vue, Chat.vue
[9] ทดสอบ dark/light theme, keyboard focus, mobile (touch)
```

---

## 8. Edge Cases ที่ต้องจัดการ

| กรณี | วิธีจัดการ |
|------|-----------|
| Tooltip ชิดขอบหน้าจอ | ตรวจ `getBoundingClientRect` แล้ว flip placement อัตโนมัติ |
| Trigger ถูก destroy ก่อน hide | `onUnmounted` / directive `unmounted` hook ล้าง timer และลบ DOM |
| Scroll หน้าจอขณะ tooltip เปิดอยู่ | ผูก `scroll` listener บน `window` เพื่อ recalculate position หรือ hide |
| Touch device | `touchstart` → show, `touchend` → hide หลัง 1.5s |
| Nested tooltip | ไม่อนุญาต — wrapper สูงสุด 1 ชั้น, ใช้ `disabled` prop ถ้าต้องการ |
| `content` เป็น HTML | ใช้ scoped slot `#content` แทน `v-html` เพื่อหลีกเลี่ยง XSS |

---

## 9. Accessibility Checklist

- [ ] `role="tooltip"` บน popup element
- [ ] `aria-describedby` บน trigger ชี้ไป tooltip `id`
- [ ] Tooltip แสดงเมื่อ focus ด้วย keyboard (`:focusin`)
- [ ] ซ่อนเมื่อ `Escape` key ถูกกด
- [ ] Contrast ratio ผ่าน WCAG AA (สี tooltip bg/text ที่เลือก)

---

## 10. การทดสอบ (Test Checklist)

- [ ] แสดงเมื่อ hover บน trigger
- [ ] ซ่อนเมื่อ mouse ออก
- [ ] placement `top`, `bottom`, `left`, `right` ถูกต้อง
- [ ] Auto-flip เมื่อออกนอกขอบจอ
- [ ] Dark theme — สี tooltip กลับด้าน
- [ ] Light theme — สี tooltip ปกติ
- [ ] Directive `v-tooltip="string"` และ `v-tooltip="{ content, placement }"` ทำงานได้
- [ ] `<Tooltip>` slot content render ถูกต้อง
- [ ] `disabled` prop ปิด tooltip ได้
- [ ] Keyboard focus แสดง tooltip
- [ ] `useTooltip` composable show/hide programmatically

---

## 11. ความเกี่ยวข้องกับ Components อื่น

```
Tooltip ─── ใช้ใน ──► TokenUsageBar   (ข้อมูล quota)
                    ► AppSidebar      (ปุ่ม action)
                    ► KnowledgeList   (ปุ่ม CRUD)
                    ► ChatInput       (ปุ่ม attach, send)
                    ► ChatMessage     (ปุ่ม copy, regenerate)
                    ► CollectionGrid  (ปุ่ม edit/delete)
                    ► AdminPanel      (ปุ่ม manage users)
```

---

*จบแผนการ — พร้อม implement เมื่อ approve*
