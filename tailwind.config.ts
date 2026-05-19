import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // ACH brand
        'ach-navy':       '#0A1F3D',
        'ach-cream':      '#FBF8F2',
        'ach-page':       '#F7F4ED',
        'ach-card':       '#FFFFFF',
        'ach-border':     '#EEEAE0',
        // domain accents (muted ~15%)
        'ach-terracotta': '#E89968',
        'ach-lavender':   '#B5A4D8',
        'ach-slate-blue': '#7DA8C9',
        'ach-honey':      '#E8C25E',
        'ach-sage':       '#95B670',
        'ach-rose':       '#D67890',
        'ach-forest':     '#3C6B47',
        // pill tints — lightest stop
        'ach-terracotta-tint': '#FBF1E5',
        'ach-lavender-tint':   '#F2EEF8',
        'ach-slate-tint':      '#EBF2F7',
        'ach-honey-tint':      '#FAF1D6',
        'ach-sage-tint':       '#EEF3E6',
        'ach-rose-tint':       '#F8E8ED',
        'ach-forest-tint':     '#E4EDE6',
        // pill text — darkest stop
        'ach-terracotta-deep': '#8C5A28',
        'ach-lavender-deep':   '#5A4988',
        'ach-slate-deep':      '#37607D',
        'ach-honey-deep':      '#876B1C',
        'ach-sage-deep':       '#4A6B30',
        'ach-rose-deep':       '#8C3A4F',
        'ach-forest-deep':     '#1F3F2A',
        // text
        'ach-text':        '#0A1F3D',
        'ach-text-muted':  '#6B7280',
        'ach-text-meta':   '#888780',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        // strict size scale per design system
        'mini': ['10.5px', { lineHeight: '1.2', letterSpacing: '1.2px' }],
        'body': ['13px', { lineHeight: '1.6', letterSpacing: '0' }],
        'h3':   ['16px', { lineHeight: '1.3', letterSpacing: '-0.3px' }],
        'h2':   ['18px', { lineHeight: '1.3', letterSpacing: '-0.3px' }],
        'h1':   ['22px', { lineHeight: '1.25', letterSpacing: '-0.3px' }],
        'stat': ['26px', { lineHeight: '1.1', letterSpacing: '-0.5px' }],
      },
      fontWeight: {
        // hard-cap at 500
        normal: '400',
        medium: '500',
      },
      borderRadius: {
        'card-outer': '14px',
        'card-inner': '12px',
        'card-small': '10px',
        'pill':       '100px',
      },
      borderWidth: {
        'hair': '0.5px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
