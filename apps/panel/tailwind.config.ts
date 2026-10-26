import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['13px', '18px'],
      base: ['14px', '20px'],
      md: ['15px', '22px'],
      lg: ['18px', '24px'],
      xl: ['22px', '28px'],
      '2xl': ['28px', '34px'],
    },
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        sunken: v('sunken'),
        border: v('border'),
        'border-strong': v('border-strong'),
        fg: v('fg'),
        'fg-2': v('fg-2'),
        'fg-3': v('fg-3'),
        primary: v('primary'),
        'primary-fg': v('primary-fg'),
        focus: v('focus'),
        success: v('success'),
        'success-bg': v('success-bg'),
        warning: v('warning'),
        'warning-bg': v('warning-bg'),
        danger: v('danger'),
        'danger-bg': v('danger-bg'),
        info: v('info'),
        'info-bg': v('info-bg'),
        envtest: v('envtest'),
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', md: '8px', lg: '10px' },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04)',
        pop: '0 8px 24px rgb(0 0 0 / 0.12), 0 2px 6px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
