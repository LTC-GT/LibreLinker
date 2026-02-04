/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './app.js', './src/**/*.{js,css}'],
  theme: {
    extend: {
      colors: {
        'brand-gold': '#9C8547',
        'brand-navy': '#003057'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio')
  ]
};
