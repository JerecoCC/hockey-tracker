import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { UserRecord } from '@/pages/admin/users/columns';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const useUsers = () => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: users = [], isLoading: loading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const { data } = await axios.get<UserRecord[]>(`${API}/admin/users`, {
          headers: authHeaders(),
        });
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load users'));
        return [] as UserRecord[];
      }
    },
  });

  const changeRole = async (id: string, role: 'admin' | 'user') => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/users/${id}/role`, { role }, { headers: authHeaders() });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
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
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete user'));
    } finally {
      setBusy(null);
    }
  };

  return { users, loading, busy, changeRole, deleteUser };
};

export default useUsers;
