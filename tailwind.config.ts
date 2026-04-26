import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d0d0d',
          card: '#161616',
          hover: '#1e1e1e',
        },
        border: '#2a2a2a',
        up: '#22c55e',
        down: '#ef4444',
        flat: '#6b7280',
        accent: '#3b82f6',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
