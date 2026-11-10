import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Vite never watches node_modules, so a newly installed tracker-ui build would otherwise
// need a dev server restart. This reloads the page instead. It watches the @jerecocc
// folder because npm install replaces the whole tracker-ui folder inside it.
const reloadOnTrackerUiInstall = (): Plugin => ({
  name: 'reload-on-tracker-ui-install',
  apply: 'serve',
  configureServer(server) {
    const scopeDir = path.resolve(rootDir, 'node_modules/@jerecocc');
    if (!fs.existsSync(scopeDir)) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const watcher = fs.watch(scopeDir, { recursive: true }, () => {
      // An install writes many files; reload once it settles.
      clearTimeout(timer);
      timer = setTimeout(() => {
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: 'full-reload' });
        server.config.logger.info('tracker-ui changed, page reloaded', { timestamp: true });
      }, 500);
    });
    server.httpServer?.on('close', () => {
      clearTimeout(timer);
      watcher.close();
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), reloadOnTrackerUiInstall()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['@jerecocc/tracker-ui'],
    include: [
      'classnames',
      '@tiptap/react > use-sync-external-store/shim/index.js',
      '@tiptap/react > use-sync-external-store/shim/with-selector.js',
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        loadPaths: [
          path.resolve(rootDir, './src'),
        ],
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },

    },
  },
})
