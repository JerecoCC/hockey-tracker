import { Column } from '../../../components/Table/Table';
import Icon from '../../../components/Icon/Icon';
import styles from './Users.module.scss';

export interface UserRecord {
  id: string;
  display_name: string;
  email: string;
  role: 'admin' | 'user';
  is_google: boolean;
  created_at: string;
}

interface ColumnDeps {
  currentUserId: string | undefined;
  busy: string | null;
  changeRole: (id: string, role: 'admin' | 'user') => void;
  deleteUser: (id: string, name: string) => void;
}

export const getUserColumns = ({ currentUserId, busy, changeRole, deleteUser }: ColumnDeps): Column<UserRecord>[] => [
  { header: 'Name', key: 'display_name' },
  { header: 'Email', key: 'email' },
  {
    type: 'custom',
    header: 'Role',
    render: (u) => (
      <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
        {u.role}
      </span>
    ),
  },
  {
    type: 'custom',
    header: 'Auth',
    render: (u) =>
      u.is_google
        ? <><Icon name="account_circle" size="1rem" style={{ color: '#4285F4', verticalAlign: '-0.2em' }} /> Google</>
        : <><Icon name="mail" size="1rem" style={{ color: '#64748b', verticalAlign: '-0.2em' }} /> Email</>,
  },
  { type: 'date', header: 'Joined', key: 'created_at' },
  {
    type: 'custom',
    header: 'Actions',
    render: (u) => {
      const isMe = u.id === currentUserId;
      const isBusy = busy === u.id;
      return (
        <div className={styles.actions}>
          {u.role !== 'admin' && (
            <button className={styles.promoteBtn} disabled={isBusy} onClick={() => changeRole(u.id, 'admin')}>
              Make Admin
            </button>
          )}
          {u.role === 'admin' && !isMe && (
            <button className={styles.demoteBtn} disabled={isBusy} onClick={() => changeRole(u.id, 'user')}>
              Remove Admin
            </button>
          )}
          {!isMe && (
            <button className={styles.deleteBtn} disabled={isBusy} onClick={() => deleteUser(u.id, u.display_name)}>
              Delete
            </button>
          )}
          {isMe && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>You</span>}
        </div>
      );
    },
  },
];