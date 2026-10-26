import type { Config } from 'tailwindcss';

// Tailwind solo para los componentes traídos de Drops (mismas clases que allá).
// Sin preflight: el resto de la app tiene sus propios estilos.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
