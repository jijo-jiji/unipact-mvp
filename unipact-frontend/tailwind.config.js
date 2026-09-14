/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1E63',
          deep: '#0A1748',
        },
        cyan: {
          DEFAULT: '#00AEEF',
          deep: '#0090C6',
        },
        unipact: {
          bg: '#F5F7FC',
          white: '#FFFFFF',
          text: '#0A1748',
          muted: '#5B6478',
          border: 'rgba(10, 23, 72, 0.12)',
          'border-strong': 'rgba(10, 23, 72, 0.22)',
        },
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}