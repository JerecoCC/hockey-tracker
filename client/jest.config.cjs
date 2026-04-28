/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    // CSS / SCSS modules → identity-obj-proxy (must come before the @/ alias)
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
    // Static assets → simple string stub
    '\\.(jpg|jpeg|png|gif|svg|ico|webp)$': '<rootDir>/src/__mocks__/fileMock.cjs',
    // Path alias: @/ → src/
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

