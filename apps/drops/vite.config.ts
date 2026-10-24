import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Reproductor de Drops. Es una página estática: todo lo que necesita lo pide al API (VITE_API_URL).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 3003 },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
