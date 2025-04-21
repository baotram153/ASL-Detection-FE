import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  server: {
    host: '0.0.0.0',               // listen on all interfaces
    port: 5173,                    // or whatever you like
    allowedHosts: ['aslmeeting.ticklab.site'], // 👈 explicit allow‑list
    // strictPort: true            // (optional) fail if 5173 is busy
  },
  preview: {
    allowedHosts: ['aslmeeting.ticklab.site']   // needed for `vite preview`
  }
})
