import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Deployed under /tools/economic-impact/ on gamblingpolicy.com
  base: '/tools/economic-impact/',
  server: { port: 3000 },
  build: { sourcemap: false },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
