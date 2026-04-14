import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import useTeams from './useTeams';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const mockTeam = {
  id: '1',
  name: 'Toronto Maple Leafs',
  code: 'TOR',
  description: null,
  location: null,
  logo: null,
  league_id: 'league-1',
  created_at: '2024-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [mockTeam] });
  (axios.isCancel as unknown as jest.Mock).mockReturnValue(false);
});

afterEach(() => localStorage.clear());

describe('useTeams', () => {
  it('fetches teams on mount and clears loading', async () => {
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([mockTeam]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('shows an error toast when the fetch fails', async () => {
    mockedAxios.get.mockRejectedValue({ response: { data: { error: 'Server error' } } });
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('addTeam() posts to /admin/teams and shows a success toast', async () => {
    mockedAxios.post.mockResolvedValue({});
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.addTeam({ name: 'Ottawa Senators', code: 'OTT' });
    });

    expect(success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams'),
      { name: 'Ottawa Senators', code: 'OTT' },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Team created!');
  });

  it('addTeam() returns false and shows an error toast on failure', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { error: 'Code already exists' } } });
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.addTeam({ name: 'Ottawa Senators', code: 'OTT' });
    });

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Code already exists');
  });

  it('updateTeam() patches /admin/teams/:id and shows a success toast', async () => {
    mockedAxios.patch.mockResolvedValue({});
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.updateTeam('1', { name: 'Updated Name' });
    });

    expect(success).toBe(true);
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams/1'),
      { name: 'Updated Name' },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Team updated!');
  });

  it('updateTeam() sends start_season_id and latest_season_id in the payload', async () => {
    mockedAxios.patch.mockResolvedValue({});
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateTeam('1', {
        start_season_id: 'season-1',
        latest_season_id: 'season-3',
      });
    });

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams/1'),
      { start_season_id: 'season-1', latest_season_id: 'season-3' },
      expect.any(Object),
    );
  });

  it('updateTeam() returns false and shows an error toast on failure', async () => {
    mockedAxios.patch.mockRejectedValue({ response: { data: { error: 'Not found' } } });
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.updateTeam('1', { name: 'X' });
    });

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Not found');
  });

  it('deleteTeam() deletes /admin/teams/:id and shows a success toast', async () => {
    mockedAxios.delete.mockResolvedValue({});
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteTeam('1');
    });

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams/1'),
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('Team deleted');
  });

  it('deleteTeam() shows an error toast on failure', async () => {
    mockedAxios.delete.mockRejectedValue({ response: { data: { error: 'Cannot delete' } } });
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteTeam('1');
    });

    expect(toast.error).toHaveBeenCalledWith('Cannot delete');
  });

  it('uploadLogo() posts FormData and returns the blob URL', async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn.example.com/team.png' } });
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const file = new File(['(binary)'], 'team.png', { type: 'image/png' });
    let url!: string | null;
    await act(async () => {
      url = await result.current.uploadLogo(file);
    });

    expect(url).toBe('https://cdn.example.com/team.png');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/teams/upload'),
      expect.any(FormData),
      expect.any(Object),
    );
  });

  it('uploadLogo() returns null and shows an error toast on failure', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { error: 'Upload failed' } } });
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let url!: string | null;
    await act(async () => {
      url = await result.current.uploadLogo(new File([''], 'team.png'));
    });

    expect(url).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Upload failed');
  });
});
