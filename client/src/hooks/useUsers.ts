import { useEffect, useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { UserRecord } from '../pages/admin/users/columns';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const useUsers = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await axios.get<UserRecord[]>(`${API}/admin/users`, {
        headers: authHeaders(),
        signal,
      });
      setUsers(data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      toast.error(apiError(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort();
  }, [fetchUsers]);

  const changeRole = async (id: string, role: 'admin' | 'user') => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/users/${id}/role`, { role }, { headers: authHeaders() });
      await fetchUsers();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update role'));
    } finally {
      setBusy(null);
    }
  };

  const deleteUser = async (id: string) => {
    setBusy(id);
    try {
      await axios.delete(`${API}/admin/users/${id}`, { headers: authHeaders() });
      await fetchUsers();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete user'));
    } finally {
      setBusy(null);
    }
  };

  return { users, loading, busy, changeRole, deleteUser };
};

export default useUsers;
