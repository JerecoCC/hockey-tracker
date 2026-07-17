export const API = import.meta.env.VITE_API_URL || '/api';

export const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const readApiError = (error: unknown): string | null => {
  const message = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === 'string' && message ? message : null;
};

export const getApiErrorMessage = (error: unknown, fallback: string): string =>
  readApiError(error) ?? fallback;

export const getDetailedApiErrorMessage = (error: unknown, fallback: string): string =>
  readApiError(error) ?? (error instanceof Error && error.message ? error.message : fallback);

export const getAggregateErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong',
): string => {
  const responseError = readApiError(error);
  if (responseError) return responseError;

  const aggregateErrors = (error as { errors?: unknown[] })?.errors;
  if (Array.isArray(aggregateErrors) && aggregateErrors.length > 0) {
    const messages = aggregateErrors
      .map((nested) => getAggregateErrorMessage(nested, ''))
      .filter(Boolean);
    if (messages.length > 0) return messages.join('; ');
  }

  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeMessage = cause && cause !== error ? getAggregateErrorMessage(cause, '') : '';
    if (error.message && causeMessage && !error.message.includes(causeMessage)) {
      return `${error.message}: ${causeMessage}`;
    }
    return error.message || causeMessage || fallback;
  }

  return typeof error === 'string' && error ? error : fallback;
};
