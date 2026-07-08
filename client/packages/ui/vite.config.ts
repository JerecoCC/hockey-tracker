import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const externalPackages = new Set([
  'classnames',
  'react',
  'react-dom',
  'react-dom/client',
  'react-dom/server',
  'react-hook-form',
  'react-router-dom',
]);

const isExternal = (id: string) =>
  externalPackages.has(id) ||
  id === 'react/jsx-runtime' ||
  id.startsWith('@fortawesome/') ||
  id.startsWith('@tiptap/');

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      cssFileName: 'style',
    },
    rollupOptions: {
      external: isExternal,
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        loadPaths: [path.resolve(__dirname, './src')],
      },
    },
  },
});
