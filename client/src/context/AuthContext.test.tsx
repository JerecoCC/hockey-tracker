import { renderHook, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used inside <AuthProvider>',
    );
    spy.mockRestore();
  });

  it('starts with null user when no token is stored', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('fetches the current user on mount when a token exists', async () => {
    const mockUser = { id: '1', display_name: 'Test User', email: 'test@test.com', role: 'user' };
    localStorage.setItem('token', 'stored-token');
    mockedAxios.get.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(mockUser);
  });

  it('removes the token from localStorage if the /auth/me request fails', async () => {
    localStorage.setItem('token', 'bad-token');
    mockedAxios.get.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(localStorage.getItem('token')).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('login() stores the token in localStorage and sets the user', async () => {
    const mockUser = { id: '1', display_name: 'Test User', email: 'test@test.com', role: 'user' };
    mockedAxios.post.mockResolvedValue({ data: { token: 'new-token', user: mockUser } });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: 'pass' });
    });

    expect(localStorage.getItem('token')).toBe('new-token');
    expect(result.current.user).toEqual(mockUser);
  });

  it('logout() clears the user state and removes the token', async () => {
    const mockUser = { id: '1', display_name: 'Test User', email: 'test@test.com', role: 'user' };
    localStorage.setItem('token', 'stored-token');
    mockedAxios.get.mockResolvedValue({ data: mockUser });
    mockedAxios.post.mockResolvedValue({});

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    await act(async () => {
      await result.current.logout();
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(result.current.user).toBeNull();
  });
});

