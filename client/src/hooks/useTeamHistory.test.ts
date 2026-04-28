import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import useTeamHistory from './useTeamHistory';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const ITER = {
  id: 'iter-1',
  team_id: 'team-1',
  name: 'Leafs',
  code: 'TOR',
  logo: null,
  note: null,
  recorded_at: '2024-01-01T00:00:00Z',
  start_season_id: null,
  start_season_name: null,
  latest_season_id: null,
  latest_season_name: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [ITER] });
  (axios.isCancel as unknown as jest.Mock).mockReturnValue(false);
});

afterEach(() => localStorage.clear());

describe('useTeamHistory', () => {
  // ── fetch ──────────────────────────────────────────────────────────────────
  it('fetches iterations on mount', async () => {
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.iterations).toEqual([ITER]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams/team-1/iterations'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('shows error toast and returns [] when fetch fails', async () => {
    mockedAxios.get.mockRejectedValue({ response: { data: { error: 'Server error' } } });
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.iterations).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('does not fetch when teamId is undefined', async () => {
    const { result } = renderHook(() => useTeamHistory(undefined), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  // ── addIteration ───────────────────────────────────────────────────────────
  it('addIteration() posts, shows success toast, and returns true', async () => {
    mockedAxios.post.mockResolvedValue({ data: ITER });
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok!: boolean;
    await act(async () => { ok = await result.current.addIteration({ name: 'Leafs' }); });

    expect(ok).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams/team-1/iterations'),
      { name: 'Leafs' },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Version recorded!');
  });

  it('addIteration() returns false and shows error toast on failure', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { error: 'Name required' } } });
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok!: boolean;
    await act(async () => { ok = await result.current.addIteration({ name: '' }); });

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Name required');
  });

  it('addIteration() returns false immediately when teamId is undefined', async () => {
    const { result } = renderHook(() => useTeamHistory(undefined), { wrapper: createWrapper() });
    let ok!: boolean;
    await act(async () => { ok = await result.current.addIteration({ name: 'X' }); });
    expect(ok).toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('addIteration() sets busy while in-flight and clears it on finish', async () => {
    let resolve!: (v: unknown) => void;
    mockedAxios.post.mockReturnValue(new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let promise!: Promise<boolean>;
    act(() => { promise = result.current.addIteration({ name: 'Leafs' }); });
    expect(result.current.busy).toBe(true);
    await act(async () => { resolve({ data: ITER }); await promise; });
    expect(result.current.busy).toBe(false);
  });

  // ── updateIteration ────────────────────────────────────────────────────────
  it('updateIteration() patches, shows success toast, and returns true', async () => {
    mockedAxios.patch.mockResolvedValue({ data: ITER });
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok!: boolean;
    await act(async () => {
      ok = await result.current.updateIteration('iter-1', { name: 'Senators' });
    });

    expect(ok).toBe(true);
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams/team-1/iterations/iter-1'),
      { name: 'Senators' },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Version updated!');
  });

  it('updateIteration() returns false and shows error toast on failure', async () => {
    mockedAxios.patch.mockRejectedValue({ response: { data: { error: 'Not found' } } });
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok!: boolean;
    await act(async () => {
      ok = await result.current.updateIteration('iter-1', { name: 'X' });
    });

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Not found');
  });

  it('updateIteration() returns false immediately when teamId is undefined', async () => {
    const { result } = renderHook(() => useTeamHistory(undefined), { wrapper: createWrapper() });
    let ok!: boolean;
    await act(async () => { ok = await result.current.updateIteration('iter-1', {}); });
    expect(ok).toBe(false);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  // ── deleteIteration ────────────────────────────────────────────────────────
  it('deleteIteration() sends DELETE, shows success toast, and returns true', async () => {
    mockedAxios.delete.mockResolvedValue({});
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok!: boolean;
    await act(async () => { ok = await result.current.deleteIteration('iter-1'); });

    expect(ok).toBe(true);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams/team-1/iterations/iter-1'),
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Version deleted');
  });

  it('deleteIteration() returns false and shows error toast on failure', async () => {
    mockedAxios.delete.mockRejectedValue({ response: { data: { error: 'Cannot delete' } } });
    const { result } = renderHook(() => useTeamHistory('team-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok!: boolean;
    await act(async () => { ok = await result.current.deleteIteration('iter-1'); });

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Cannot delete');
  });

  it('deleteIteration() returns false immediately when teamId is undefined', async () => {
    const { result } = renderHook(() => useTeamHistory(undefined), { wrapper: createWrapper() });
    let ok!: boolean;
    await act(async () => { ok = await result.current.deleteIteration('iter-1'); });
    expect(ok).toBe(false);
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });
});
