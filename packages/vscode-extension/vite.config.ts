import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { join } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'media',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/webview/app/index.tsx',
      output: {
        entryFileNames: 'webview.js',
        assetFileNames: 'webview.css'
      }
    }
  }
})
