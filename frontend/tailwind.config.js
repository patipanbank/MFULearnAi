/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                // Semantic mappings to standard Tailwind colors
                brand: {
                    50: '#eff6ff', // blue-50
                    100: '#dbeafe', // blue-100
                    500: '#3b82f6', // blue-500
                    600: '#2563eb', // blue-600
                    700: '#1d4ed8', // blue-700
                },
                canvas: {
                    DEFAULT: '#0f172a', // slate-900
                    overlay: '#1e293b', // slate-800
                    muted: '#334155',   // slate-700
                }
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}
