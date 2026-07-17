import { syncGoogleCalendarWithProgress } from './googleCalendarSync';

const originalFetch = globalThis.fetch;

const streamBody = (...chunks: string[]) => {
  const encoder = new TextEncoder();
  const values = chunks.map((chunk) => encoder.encode(chunk));
  let index = 0;
  return {
    getReader: () => ({
      read: jest.fn(async () =>
        index < values.length
          ? { done: false, value: values[index++] }
          : { done: true, value: undefined },
      ),
    }),
  } as ReadableStream<Uint8Array>;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('Google Calendar progress sync client', () => {
  it('reads chunked progress records and returns the final result', async () => {
    const onProgress = jest.fn();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: streamBody(
        '{"type":"progress","progress":{"step":"sync","message":"Synced AWY @ HOM",',
        '"completed":1,"total":2}}\n{"type":"result","result":{"status":"synced","synced":2,"removed":0}}\n',
      ),
    });

    await expect(
      syncGoogleCalendarWithProgress({
        endpoint: '/api/user/calendar/google/sync',
        headers: { Authorization: 'Bearer token' },
        onProgress,
      }),
    ).resolves.toEqual({ status: 'synced', synced: 2, removed: 0 });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/user/calendar/google/sync', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        Accept: 'application/x-ndjson',
      },
    });
    expect(onProgress).toHaveBeenCalledWith({
      step: 'sync',
      message: 'Synced AWY @ HOM',
      completed: 1,
      total: 2,
    });
  });

  it('surfaces a streamed sync failure', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: streamBody('{"type":"error","error":"Calendar API unavailable"}\n'),
    });

    await expect(
      syncGoogleCalendarWithProgress({ endpoint: '/api/user/calendar/google/sync' }),
    ).rejects.toThrow('Calendar API unavailable');
  });
});
