import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base + HashRouter means the built site works unchanged at any
  // path: GitHub Pages project sites, Netlify, Vercel, or a plain file server.
  base: './',
})
