import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    // Use esbuild for minification (Vite's default, very fast)
    minify: 'esbuild',
    // Configure code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'charts': ['recharts'],
          // PDF and PPTX generators are already lazy-loaded via dynamic imports
          // They will automatically become separate chunks
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 600,
    // Disable source maps for smaller production builds
    sourcemap: false
  }
})
