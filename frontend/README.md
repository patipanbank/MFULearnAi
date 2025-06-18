# MFU Learn AI Frontend

A modern React + TypeScript frontend for the MFU Learn AI chatbot system.

## 🎨 Theme System

Our frontend uses a comprehensive theme system built with CSS variables and Tailwind CSS for consistent dark/light mode support.

### Theme Architecture

Instead of hardcoding `dark:` classes everywhere, we use semantic color tokens that automatically adapt to the current theme:

```tsx
// ❌ Old approach - Hard to maintain
<div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">

// ✅ New approach - Semantic and maintainable  
<div className="bg-primary text-primary">
```

### Available Theme Classes

#### Background Colors
- `bg-primary` - Main background color
- `bg-secondary` - Secondary background (lighter/darker than primary)
- `bg-tertiary` - Tertiary background (even lighter/darker)

#### Text Colors
- `text-primary` - Primary text color (high contrast)
- `text-secondary` - Secondary text color (medium contrast)
- `text-muted` - Muted text color (low contrast)

#### Borders
- `border-primary` - Primary border color
- `border-secondary` - Secondary border color

#### Component Classes
- `card` - Standard card with background, border, and shadow
- `card-hover` - Adds hover effect to cards
- `input` - Standard input field styling
- `btn-primary` - Primary button style
- `btn-secondary` - Secondary button style
- `btn-ghost` - Ghost/minimal button style
- `dropdown-menu` - Dropdown menu with animation
- `modal-content` - Modal content with animation

### Usage Examples

```tsx
// Card component
<div className="card card-hover p-4">
  <h3 className="text-primary font-semibold">Card Title</h3>
  <p className="text-secondary">Card description</p>
</div>

// Input field
<input className="input w-full" placeholder="Enter text..." />

// Buttons
<button className="btn-primary">Save</button>
<button className="btn-secondary">Cancel</button>
<button className="btn-ghost">Options</button>

// Modal
<div className="modal-overlay">
  <div className="modal-content">
    <h2 className="text-primary">Modal Title</h2>
  </div>
</div>
```

### CSS Variables

All theme colors are defined as CSS variables in `src/index.css`:

```css
:root {
  --color-background: 255 255 255;
  --color-foreground: 17 24 39;
  --color-card: 255 255 255;
  /* ... more variables */
}

.dark {
  --color-background: 15 23 42;
  --color-foreground: 248 250 252;
  --color-card: 30 41 59;
  /* ... dark theme variables */
}
```

### Benefits

1. **Consistency** - All components use the same color system
2. **Maintainability** - Change theme colors in one place
3. **Extensibility** - Easy to add new themes (high contrast, colorful, etc.)
4. **Performance** - No need to duplicate styles for each theme
5. **Developer Experience** - Semantic class names are easier to understand

### Migration Guide

When updating existing components:

1. Replace hardcoded colors with semantic classes
2. Use component classes for common patterns
3. Remove redundant `dark:` classes where possible
4. Test in both light and dark modes

```tsx
// Before
<div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100">

// After  
<div className="card text-primary">
```

## 🚀 Getting Started

```bash
npm install
npm run dev
```

## 📁 Project Structure

```
src/
├── app/                 # App configuration and providers
├── config/             # Configuration files
├── entities/           # Business entities and stores
├── pages/              # Page components
├── shared/             # Shared components and utilities
│   ├── hooks/          # Custom React hooks
│   ├── stores/         # Zustand stores
│   ├── types/          # TypeScript types
│   └── ui/             # Reusable UI components
└── index.css           # Global styles and theme variables
```

## 🛠️ Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Zustand** - State management
- **React Icons** - Icon library

## 🎯 Features

- **Dark/Light Mode** - Automatic theme switching
- **Responsive Design** - Mobile-first approach
- **Real-time Chat** - WebSocket-based messaging
- **File Upload** - Image support in chat
- **Authentication** - SAML SSO integration
- **State Management** - Persistent stores with Zustand
