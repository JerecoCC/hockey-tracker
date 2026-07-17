'use strict';

const { runtimeSecret } = require('./env');

describe('runtimeSecret', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.TEST_RUNTIME_SECRET;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSecret === undefined) delete process.env.TEST_RUNTIME_SECRET;
    else process.env.TEST_RUNTIME_SECRET = originalSecret;
  });

  it('uses a configured secret', () => {
    process.env.TEST_RUNTIME_SECRET = ' configured-secret ';
    expect(runtimeSecret('TEST_RUNTIME_SECRET', 'development-secret')).toBe('configured-secret');
  });

  it('allows an explicit development fallback outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_RUNTIME_SECRET;
    expect(runtimeSecret('TEST_RUNTIME_SECRET', 'development-secret')).toBe('development-secret');
  });

  it('rejects a missing production secret', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TEST_RUNTIME_SECRET;
    expect(() => runtimeSecret('TEST_RUNTIME_SECRET', 'development-secret')).toThrow(
      'TEST_RUNTIME_SECRET must be configured in production',
    );
  });
});
