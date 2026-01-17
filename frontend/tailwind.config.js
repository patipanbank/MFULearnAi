/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Custom colors if needed, but we'll stick to slate/emerald/blue/indigo for now
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}
