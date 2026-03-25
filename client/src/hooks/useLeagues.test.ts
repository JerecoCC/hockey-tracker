import { renderHook, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import { toast } from 'react-toastify';
import useLeagues from './useLeagues';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const mockLeague = {
  id: '1',
  name: 'NHL',
  code: 'NHL',
  description: null,
  logo: null,
  created_at: '2024-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [mockLeague] });
  (axios.isCancel as jest.Mock).mockReturnValue(false);
});

afterEach(() => localStorage.clear());

describe('useLeagues', () => {
  it('fetches leagues on mount and clears loading', async () => {
    const { result } = renderHook(() => useLeagues());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.leagues).toEqual([mockLeague]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/leagues'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('addLeague() posts to /admin/leagues and shows success toast', async () => {
    mockedAxios.post.mockResolvedValue({});
    const { result } = renderHook(() => useLeagues());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.addLeague({ name: 'AHL', code: 'AHL' });
    });

    expect(success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/leagues'),
      { name: 'AHL', code: 'AHL' },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('League created!');
  });

  it('addLeague() returns false and shows error toast on failure', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { error: 'Already exists' } } });
    const { result } = renderHook(() => useLeagues());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success!: boolean;
    await act(async () => {
      success = await result.current.addLeague({ name: 'AHL', code: 'AHL' });
    });

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Already exists');
  });

  it('updateLeague() patches /admin/leagues/:id and shows success toast', async () => {
    mockedAxios.patch.mockResolvedValue({});
    const { result } = renderHook(() => useLeagues());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateLeague('1', { name: 'Updated NHL' });
    });

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/leagues/1'),
      { name: 'Updated NHL' },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('League updated!');
  });

  it('deleteLeague() deletes /admin/leagues/:id and shows success toast', async () => {
    mockedAxios.delete.mockResolvedValue({});
    const { result } = renderHook(() => useLeagues());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteLeague('1');
    });

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/admin/leagues/1'),
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith('League deleted');
  });

  it('uploadLogo() posts FormData and returns the blob URL', async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn.example.com/logo.png' } });
    const { result } = renderHook(() => useLeagues());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const file = new File(['(binary)'], 'logo.png', { type: 'image/png' });
    let url!: string | null;
    await act(async () => {
      url = await result.current.uploadLogo(file);
    });

    expect(url).toBe('https://cdn.example.com/logo.png');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/leagues/upload'),
      expect.any(FormData),
      expect.any(Object),
    );
  });

  it('uploadLogo() returns null and shows error toast on failure', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { error: 'Upload failed' } } });
    const { result } = renderHook(() => useLeagues());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let url!: string | null;
    await act(async () => {
      url = await result.current.uploadLogo(new File([''], 'logo.png'));
    });

    expect(url).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Upload failed');
  });
});

