import path from 'path';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...(viteConfig.resolve?.alias ?? {}),
        'tracker-ui': path.resolve(__dirname, '../../../tracker-ui/src'),
        '@': path.resolve(__dirname, '../src'),
      },
    },
    css: {
      ...viteConfig.css,
      preprocessorOptions: {
        ...viteConfig.css?.preprocessorOptions,
        scss: {
          ...(viteConfig.css?.preprocessorOptions?.scss ?? {}),
          api: 'modern-compiler',
          loadPaths: [
            path.resolve(__dirname, '../src'),
            path.resolve(__dirname, '../../../tracker-ui/src'),
          ],
        },
      },
    },
  }),
};

export default config;
