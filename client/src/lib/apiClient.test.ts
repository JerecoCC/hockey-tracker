import {
  API,
  authHeaders,
  getAggregateErrorMessage,
  getApiErrorMessage,
  getDetailedApiErrorMessage,
} from './apiClient';

describe('API client configuration', () => {
  afterEach(() => localStorage.clear());

  it('defaults to the same-origin API path', () => {
    expect(API).toBe('/api');
  });

  it('reads the latest bearer token for every request', () => {
    localStorage.setItem('token', 'first-token');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer first-token' });

    localStorage.setItem('token', 'refreshed-token');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer refreshed-token' });
  });

  it('normalizes API, native, and aggregate errors', () => {
    const responseError = { response: { data: { error: 'Request rejected' } } };
    expect(getApiErrorMessage(responseError, 'Fallback')).toBe('Request rejected');
    expect(getApiErrorMessage(new Error('Network failed'), 'Fallback')).toBe('Fallback');
    expect(getDetailedApiErrorMessage(new Error('Network failed'), 'Fallback')).toBe(
      'Network failed',
    );
    expect(
      getAggregateErrorMessage({ errors: [responseError, new Error('Second failure')] }),
    ).toBe('Request rejected; Second failure');
  });
});
