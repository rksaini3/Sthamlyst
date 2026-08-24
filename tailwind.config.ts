import type { Config } from 'tailwindcss'

// Sthamly Design System v2 — five colors, five jobs. Never decorative.
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Clay — brand + primary actions (watch, upload, buy)
        clay: { DEFAULT: '#B5451B', dark: '#8f3715', light: '#f3e2d8' },
        // Indigo — structure, navigation, trust & safety
        indigobrand: { DEFAULT: '#2B3A67', dark: '#1e2949', light: '#e4e7f0' },
        // Turmeric — coins, quiz, rewards (never money itself)
        turmeric: { DEFAULT: '#C68E17', dark: '#9c7012', light: '#faf0d9' },
        // Mehendi — real money: savings, earnings, GMV
        mehendi: { DEFAULT: '#4C7A4C', dark: '#3a5e3a', light: '#e3ede3' },
        // Dupatta Violet — personal growth + AI (Sahayak, learning agent)
        violet: { DEFAULT: '#6B4E8E', dark: '#523a6d', light: '#ede7f3' },
      },
      fontFamily: {
        heading: ['var(--font-fraunces)', 'serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        devanagari: ['var(--font-noto-devanagari)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
