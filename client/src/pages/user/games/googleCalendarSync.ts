export interface GoogleCalendarSyncResult {
  status: 'synced';
  synced: number;
  removed: number;
}

export interface GoogleCalendarSyncProgress {
  step: 'prepare' | 'sync' | 'remove' | 'complete';
  message: string;
  completed?: number;
  total?: number;
}

type GoogleCalendarSyncStreamItem =
  | { type: 'progress'; progress: GoogleCalendarSyncProgress }
  | { type: 'result'; result: GoogleCalendarSyncResult }
  | { type: 'error'; error: string };

interface GoogleCalendarSyncOptions {
  endpoint: string;
  headers?: Record<string, string>;
  onProgress?: (progress: GoogleCalendarSyncProgress) => void;
}

const errorMessageFromResponse = async (response: Response) => {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || 'Failed to sync Google Calendar';
  } catch {
    return 'Failed to sync Google Calendar';
  }
};

const isSyncResult = (value: unknown): value is GoogleCalendarSyncResult => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<GoogleCalendarSyncResult>;
  return (
    result.status === 'synced' &&
    typeof result.synced === 'number' &&
    typeof result.removed === 'number'
  );
};

export const syncGoogleCalendarWithProgress = async ({
  endpoint,
  headers,
  onProgress,
}: GoogleCalendarSyncOptions): Promise<GoogleCalendarSyncResult> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      Accept: 'application/x-ndjson',
    },
  });

  if (!response.ok) throw new Error(await errorMessageFromResponse(response));
  if (!response.body) {
    const result = (await response.json()) as unknown;
    if (isSyncResult(result)) return result;
    throw new Error('Google Calendar sync ended without a result');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: GoogleCalendarSyncResult | null = null;

  const processLine = (line: string) => {
    if (!line.trim()) return;
    const item = JSON.parse(line) as GoogleCalendarSyncStreamItem | GoogleCalendarSyncResult;
    if (isSyncResult(item)) {
      result = item;
      return;
    }
    if (item.type === 'progress') {
      onProgress?.(item.progress);
      return;
    }
    if (item.type === 'result') {
      result = item.result;
      return;
    }
    throw new Error(item.error || 'Failed to sync Google Calendar');
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(processLine);
    if (done) break;
  }
  processLine(buffer);

  if (!result) throw new Error('Google Calendar sync ended without a result');
  return result;
};
