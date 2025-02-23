/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      // Custom scrollbar styling
      scrollbar: {
        DEFAULT: {
          size: '8px',
          track: {
            background: '#f1f1f1',
          },
          thumb: {
            background: '#888',
            'hover-background': '#555',
            'border-radius': '4px',
          },
        },
        thin: {
          size: '2px',
        },
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
}

