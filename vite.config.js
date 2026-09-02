import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

// Every build gets an id, baked into the bundle AND written to version.json.
// The running app polls that file and compares; when they differ, a new deploy
// has landed and the app offers a reload. Without this the index.html sits in
// the browser cache pointing at an old bundle, and the only fix is knowing to
// hard-refresh — which nobody you share this with is going to know to do.
const BUILD_ID = `${gitSha()}-${Date.now().toString(36)}`

function emitVersionFile() {
  return {
    name: 'emit-version-file',
    apply: 'build',
    closeBundle() {
      writeFileSync(
        join(process.cwd(), 'dist', 'version.json'),
        JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() }, null, 2),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), emitVersionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  // Relative base + HashRouter means the built site works unchanged at any
  // path: GitHub Pages project sites, Netlify, Vercel, or a plain file server.
  base: './',
})
