/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Professional motion design tokens
      transitionDuration: {
        '175': '175ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'smooth-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      keyframes: {
        // Subtle fade-in for page elements
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Gentle slide-up for modals and cards
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Gentle slide-down for dropdowns
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Subtle scale for buttons and interactive elements
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up': 'slide-up 250ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-down': 'slide-down 200ms cubic-bezier(0, 0, 0.2, 1)',
        'scale-in': 'scale-in 175ms cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

