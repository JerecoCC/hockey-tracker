'use strict';

const runtimeSecret = (name, developmentFallback) => {
  const value = String(process.env[name] || '').trim();
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be configured in production`);
  }
  return developmentFallback;
};

module.exports = { runtimeSecret };
