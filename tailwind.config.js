/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1F4FE0',
        secondary: '#0E9F6E',
        accent: '#E8820C',
        paper: '#F7F4EF',
        ink: '#17130E',
        line: '#E8E2D7',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.85rem',
        '2xl': '1.15rem',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(23,19,14,0.05)',
        DEFAULT: '0 1px 3px rgba(23,19,14,0.07), 0 1px 2px rgba(23,19,14,0.04)',
        md: '0 6px 20px -6px rgba(23,19,14,0.10), 0 2px 6px -2px rgba(23,19,14,0.06)',
        lg: '0 16px 36px -10px rgba(23,19,14,0.14), 0 4px 10px -4px rgba(23,19,14,0.08)',
        xl: '0 28px 56px -14px rgba(23,19,14,0.20)',
      },
    },
  },
  plugins: [],
}
