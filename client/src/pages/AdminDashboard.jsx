import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import styles from './AdminDashboard.module.css';

const API = import.meta.env.VITE_API_URL || '/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // id of row being mutated

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/users`, { headers: authHeaders() });
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function changeRole(id, role) {
    setBusy(id);
    setError('');
    try {
      await axios.patch(`${API}/admin/users/${id}/role`, { role }, { headers: authHeaders() });
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role');
    } finally {
      setBusy(null);
    }
  }

  async function deleteUser(id, name) {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setBusy(id);
    setError('');
    try {
      await axios.delete(`${API}/admin/users/${id}`, { headers: authHeaders() });
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>🛡️ Admin Dashboard</h1>
          <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
        </div>

        <div className={styles.card}>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Auth</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyMsg}>No users found.</td>
                  </tr>
                )}
                {users.map((u) => {
                  const isMe = u.id === user?.id;
                  const isBusy = busy === u.id;
                  return (
                    <tr key={u.id}>
                      <td>{u.display_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u.is_google ? '🔵 Google' : '📧 Email'}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className={styles.actions}>
                          {u.role !== 'admin' && (
                            <button
                              className={styles.promoteBtn}
                              disabled={isBusy}
                              onClick={() => changeRole(u.id, 'admin')}
                            >
                              Make Admin
                            </button>
                          )}
                          {u.role === 'admin' && !isMe && (
                            <button
                              className={styles.demoteBtn}
                              disabled={isBusy}
                              onClick={() => changeRole(u.id, 'user')}
                            >
                              Remove Admin
                            </button>
                          )}
                          {!isMe && (
                            <button
                              className={styles.deleteBtn}
                              disabled={isBusy}
                              onClick={() => deleteUser(u.id, u.display_name)}
                            >
                              Delete
                            </button>
                          )}
                          {isMe && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>You</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

