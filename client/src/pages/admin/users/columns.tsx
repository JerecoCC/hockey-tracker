import { Column } from '../../../components/Table/Table';
import Button from '../../../components/Button/Button';
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
  confirmRole: (user: UserRecord, role: 'admin' | 'user') => void;
  confirmDelete: (user: UserRecord) => void;
}

export const getUserColumns = ({
  currentUserId,
  busy,
  confirmRole,
  confirmDelete,
}: ColumnDeps): Column<UserRecord>[] => [
  { header: 'Name', key: 'display_name' },
  { header: 'Email', key: 'email' },
  {
    type: 'custom',
    header: 'Role',
    render: (u) => (
      <span
        className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}
      >
        {u.role}
      </span>
    ),
  },
  {
    type: 'custom',
    header: 'Auth',
    render: (u) =>
      u.is_google ? (
        <>
          <Icon
            name="account_circle"
            size="1rem"
            style={{ color: '#4285F4', verticalAlign: '-0.2em' }}
          />{' '}
          Google
        </>
      ) : (
        <>
          <Icon
            name="mail"
            size="1rem"
            style={{ color: '#64748b', verticalAlign: '-0.2em' }}
          />{' '}
          Email
        </>
      ),
  },
  { type: 'date', header: 'Joined', key: 'created_at' },
  {
    type: 'custom',
    header: 'Actions',
    align: 'center',
    render: (u) => {
      const isMe = u.id === currentUserId;
      const isBusy = busy === u.id;
      return (
        <div className={styles.actions}>
          {u.role !== 'admin' && (
            <Button
              variant="outlined"
              intent="accent"
              icon="manage_accounts"
              size="sm"
              title="Make Admin"
              disabled={isBusy}
              onClick={() => confirmRole(u, 'admin')}
            />
          )}
          {u.role === 'admin' && !isMe && (
            <Button
              variant="outlined"
              intent="info"
              icon="person_remove"
              size="sm"
              title="Remove Admin"
              disabled={isBusy}
              onClick={() => confirmRole(u, 'user')}
            />
          )}
          {!isMe && (
            <Button
              variant="outlined"
              intent="danger"
              icon="delete"
              size="sm"
              title="Delete"
              disabled={isBusy}
              onClick={() => confirmDelete(u)}
            />
          )}
          {isMe && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>You</span>}
        </div>
      );
    },
  },
];
