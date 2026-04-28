import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import useSeasons from '@/hooks/useSeasons';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const mockSeason = {
  id: '1',
  name: '2024-25',
  league_id: 'league-1',
  league_name: 'NHL',
  league_code: 'NHL',
  league_logo: null,
  start_date: '2024-10-01',
  end_date: '2025-04-15',
  created_at: '2024-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [mockSeason] });
  (axios.isCancel as unknown as jest.Mock).mockReturnValue(false);
});

afterEach(() => localStorage.clear());

describe('useSeasons', () => {
  it('fetches seasons on mount and clears loading', async () => {
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.seasons).toEqual([mockSeason]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/seasons'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('passes league_id as a query param when leagueId is provided', async () => {
    const { result } = renderHook(() => useSeasons('league-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/seasons'),
      expect.objectContaining({ params: { league_id: 'league-1' } }),
    );
  });

  it('does not pass params when no leagueId is provided', async () => {
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/seasons'),
      expect.objectContaining({ params: undefined }),
    );
  });

  it('shows an error toast when the fetch fails', async () => {
    mockedAxios.get.mockRejectedValue({ response: { data: { error: 'Server error' } } });
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('addSeason() posts to /admin/seasons and shows a success toast', async () => {
    mockedAxios.post.mockResolvedValue({});
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.addSeason({ league_id: 'league-1', start_date: '2025-10-01' });
    });

    expect(success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/seasons'),
      { league_id: 'league-1', start_date: '2025-10-01' },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Season created!');
  });

  it('addSeason() returns false and shows an error toast on failure', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { error: 'Invalid data' } } });
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.addSeason({ league_id: 'league-1' });
    });

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Invalid data');
  });

  it('updateSeason() patches /admin/seasons/:id and shows a success toast', async () => {
    mockedAxios.patch.mockResolvedValue({});
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.updateSeason('1', { end_date: '2025-06-01' });
    });

    expect(success).toBe(true);
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/seasons/1'),
      { end_date: '2025-06-01' },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Season updated!');
  });

  it('updateSeason() returns false and shows an error toast on failure', async () => {
    mockedAxios.patch.mockRejectedValue({ response: { data: { error: 'Not found' } } });
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.updateSeason('1', { end_date: '2025-06-01' });
    });

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Not found');
  });

  it('deleteSeason() deletes /admin/seasons/:id and shows a success toast', async () => {
    mockedAxios.delete.mockResolvedValue({});
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteSeason('1');
    });

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/admin/seasons/1'),
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Season deleted');
  });

  it('deleteSeason() shows an error toast on failure', async () => {
    mockedAxios.delete.mockRejectedValue({ response: { data: { error: 'Cannot delete' } } });
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteSeason('1');
    });

    expect(toast.error).toHaveBeenCalledWith('Cannot delete');
  });

  it('sets busy to the season id while updateSeason is in flight, then clears it', async () => {
    let resolve!: () => void;
    mockedAxios.patch.mockReturnValue(new Promise((r) => { resolve = () => r({}); }));
    const { result } = renderHook(() => useSeasons(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.updateSeason('1', {}); });
    await waitFor(() => expect(result.current.busy).toBe('1'));

    await act(async () => resolve());
    await waitFor(() => expect(result.current.busy).toBeNull());
  });
});
