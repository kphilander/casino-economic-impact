import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Base path for deployment under /tools/economic-impact/ on gpconsulting.com
  base: '/tools/economic-impact/',
  server: {
    port: 3000
  },
  build: {
    // Use terser for minification. esbuild's minifier can reorder declarations
    // in a way that trips a temporal-dead-zone error ("Cannot access X before
    // initialization") in the bundled pptxgenjs/docx report generators; terser
    // preserves TDZ-safe ordering.
    minify: 'terser',
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
