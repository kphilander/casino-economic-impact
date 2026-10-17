import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const git = (args: string): string => {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

// The commit the bundle is built from, shown in the footer and Method tab so
// the hosted copy can be traced to the repository. "dirty" marks a build with
// uncommitted changes under webapp/. Vite writes a temporary
// vite.config.ts.timestamp-*.mjs while it loads this file; it is not a change.
const changes = git('status --porcelain -- .')
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.includes('vite.config.ts.timestamp-'));
const build = {
  commit: process.env.GEMS_BUILD_COMMIT || git('rev-parse --short HEAD') || 'unknown',
  dirty: changes.length > 0,
  date: new Date().toISOString().slice(0, 10),
};

export default defineConfig({
  plugins: [react()],
  // Deployed under /tools/economic-impact/ on gamblingpolicy.com
  base: '/tools/economic-impact/',
  server: { port: 3000 },
  build: { sourcemap: false },
  define: { __GEMS_BUILD__: JSON.stringify(build) },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
