import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { UserRecord } from '../pages/admin/users/columns';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';



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

  const changeRole = async (id: string, role: 'admin' | 'user'): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/users/${id}/role`, { role }, { headers: authHeaders() });
      toast.success('Role updated');
      // The list refreshes in the background, so callers aren't held up by it.
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update role'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.delete(`${API}/admin/users/${id}`, { headers: authHeaders() });
      toast.success('User deleted');
      // The list refreshes in the background, so callers aren't held up by it.
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete user'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { users, loading, busy, changeRole, deleteUser };
};

export default useUsers;
