/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^react/jsx-runtime$': '<rootDir>/node_modules/react/jsx-runtime.js',
    '^react/jsx-dev-runtime$': '<rootDir>/node_modules/react/jsx-dev-runtime.js',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
    '^react-hook-form$': '<rootDir>/node_modules/react-hook-form/dist/index.cjs.js',
    '^react-router-dom$': '<rootDir>/node_modules/react-router-dom/dist/index.js',
    '^classnames$': '<rootDir>/node_modules/classnames/index.js',
    '^@fortawesome/(.*)$': '<rootDir>/node_modules/@fortawesome/$1',
    '^@tiptap/(.*)$': '<rootDir>/node_modules/@tiptap/$1',
    // CSS / SCSS modules → identity-obj-proxy (must come before the @/ alias)
    '\\.(css|scss|sass)$': '<rootDir>/node_modules/identity-obj-proxy',
    // Static assets → simple string stub
    '\\.(jpg|jpeg|png|gif|svg|ico|webp)$': '<rootDir>/src/__mocks__/fileMock.cjs',
    // Path alias: @/ → src/
    '^tracker-ui$': '<rootDir>/../../tracker-ui/src/index.ts',
    '^tracker-ui/(.*)$': '<rootDir>/../../tracker-ui/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

