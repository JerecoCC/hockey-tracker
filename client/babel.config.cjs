/** @type {import('@babel/core').ConfigFunction} */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  plugins: [
    // Transforms import.meta → ({ env: process.env }) so Jest (CommonJS) can parse it.
    // import.meta.env.VITE_API_URL becomes process.env.VITE_API_URL (undefined in tests),
    // which causes the hooks to fall back to '/api'.
    function importMetaPlugin() {
      return {
        visitor: {
          MetaProperty(path) {
            path.replaceWithSourceString('({ env: process.env })');
          },
        },
      };
    },
  ],
};

