const express = require('express');
const request = require('supertest');
const {
  HttpError,
  asyncRoute,
  errorHandler,
  notFoundHandler,
} = require('./errors');

function testApp(route) {
  const app = express();
  if (route) app.get('/test', route);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('server error middleware', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('maps rejected async routes to public operational errors', async () => {
    const route = asyncRoute(
      async () => {
        throw new Error('database details');
      },
      {
        mapError: (error) =>
          new HttpError(502, 'Calendar provider unavailable', {
            cause: error,
            expose: true,
          }),
      },
    );

    const response = await request(testApp(route)).get('/test');

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'Calendar provider unavailable' });
    expect(consoleError).toHaveBeenCalled();
  });

  it('maps synchronous route failures through the same boundary', async () => {
    const route = asyncRoute(
      () => {
        throw new Error('configuration details');
      },
      {
        mapError: (error) =>
          new HttpError(500, 'Unable to start provider connection', {
            cause: error,
            expose: true,
          }),
      },
    );

    const response = await request(testApp(route)).get('/test');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unable to start provider connection' });
  });

  it('does not expose unexpected internal error messages', async () => {
    const response = await request(
      testApp(
        asyncRoute(async () => {
          throw new Error('database password leaked');
        }),
      ),
    ).get('/test');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
  });

  it('returns a consistent JSON 404 response', async () => {
    const response = await request(testApp()).get('/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Route not found' });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
