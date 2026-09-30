import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: process.cwd(),
  base: './',
  plugins: [react()],
  server: {
    watch: { ignored: ['**/dist/**', '**/dist-electron/**', '**/release/**', '**/release-test/**', '**/.artifacts/**'] }
  },
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'electron/**/*.test.ts'], environment: 'node' }
});
