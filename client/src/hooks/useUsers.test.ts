import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import useUsers from '@/hooks/useUsers';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const mockUser = {
  id: '1',
  display_name: 'Alice',
  email: 'alice@example.com',
  role: 'user' as const,
  is_google: false,
  created_at: '2024-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [mockUser] });
  (axios.isCancel as unknown as jest.Mock).mockReturnValue(false);
});

afterEach(() => localStorage.clear());

describe('useUsers', () => {
  it('fetches users on mount and clears loading', async () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.users).toEqual([mockUser]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/users'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('changeRole() patches /admin/users/:id/role with the new role', async () => {
    mockedAxios.patch.mockResolvedValue({});
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.changeRole('1', 'admin');
    });

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/users/1/role'),
      { role: 'admin' },
      expect.any(Object),
    );
  });

  it('changeRole() shows error toast on failure', async () => {
    mockedAxios.patch.mockRejectedValue({ response: { data: { error: 'Forbidden' } } });
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.changeRole('1', 'admin');
    });

    expect(toast.error).toHaveBeenCalledWith('Forbidden');
  });

  it('deleteUser() deletes /admin/users/:id', async () => {
    mockedAxios.delete.mockResolvedValue({});
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteUser('1');
    });

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/admin/users/1'),
      expect.any(Object),
    );
  });

  it('deleteUser() shows error toast on failure', async () => {
    mockedAxios.delete.mockRejectedValue({ response: { data: { error: 'Not found' } } });
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteUser('1');
    });

    expect(toast.error).toHaveBeenCalledWith('Not found');
  });
});
