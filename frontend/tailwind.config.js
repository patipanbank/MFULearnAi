/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Base theme colors using CSS variables
        background: {
          DEFAULT: 'rgb(var(--color-background) / <alpha-value>)',
          secondary: 'rgb(var(--color-background-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-background-tertiary) / <alpha-value>)',
        },
        foreground: {
          DEFAULT: 'rgb(var(--color-foreground) / <alpha-value>)',
          secondary: 'rgb(var(--color-foreground-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-foreground-tertiary) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          secondary: 'rgb(var(--color-border-secondary) / <alpha-value>)',
        },
        input: {
          DEFAULT: 'rgb(var(--color-input) / <alpha-value>)',
          placeholder: 'rgb(var(--color-input-placeholder) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--color-card) / <alpha-value>)',
          hover: 'rgb(var(--color-card-hover) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--color-muted) / <alpha-value>)',
          foreground: 'rgb(var(--color-muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          foreground: 'rgb(var(--color-accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--color-destructive) / <alpha-value>)',
          foreground: 'rgb(var(--color-destructive-foreground) / <alpha-value>)',
        },
        // Semantic aliases for easier usage
        primary: 'rgb(var(--color-foreground) / <alpha-value>)',
        secondary: 'rgb(var(--color-foreground-secondary) / <alpha-value>)',
        // Additional theme colors
        sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
        header: 'rgb(var(--color-header) / <alpha-value>)',
        dropdown: 'rgb(var(--color-dropdown) / <alpha-value>)',
        modal: 'rgb(var(--color-modal) / <alpha-value>)',
        toast: {
          success: 'rgb(var(--color-toast-success) / <alpha-value>)',
          error: 'rgb(var(--color-toast-error) / <alpha-value>)',
          warning: 'rgb(var(--color-toast-warning) / <alpha-value>)',
          info: 'rgb(var(--color-toast-info) / <alpha-value>)',
        },
      },
      animation: {
        'slide-in-from-top-2': 'slide-in-from-top-2 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-from-bottom-2': 'slide-in-from-bottom-2 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'slide-in-from-top-2': {
          from: { transform: 'translateY(-8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-bottom-2': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [],
} 