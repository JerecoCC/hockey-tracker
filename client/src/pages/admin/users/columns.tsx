import { Column } from '@/components/Table/Table';
import Button from '@/components/Button/Button';
import Icon from '@/components/Icon/Icon';
import Badge from '@/components/Badge/Badge';
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

export const getUserColumns = (deps: ColumnDeps): Column<UserRecord>[] => {
  const { currentUserId, busy, confirmRole, confirmDelete } = deps;
  return [
    { header: 'Name', key: 'display_name', sortable: true },
    { header: 'Email', key: 'email', sortable: true },
    {
      type: 'custom',
      header: 'Role',
      sortable: true,
      sortKey: 'role',
      render: (u) => (
        <Badge
          label={u.role}
          intent={u.role === 'admin' ? 'accent' : 'info'}
        />
      ),
    },
    {
      type: 'custom',
      header: 'Auth',
      sortable: true,
      sortKey: 'is_google',
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
    { type: 'date', header: 'Joined', key: 'created_at', sortable: true },
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
                disabled={isBusy}
                tooltip="Make Admin"
                onClick={() => confirmRole(u, 'admin')}
              />
            )}
            {u.role === 'admin' && !isMe && (
              <Button
                variant="outlined"
                intent="info"
                icon="person_remove"
                size="sm"
                disabled={isBusy}
                tooltip="Remove Admin"
                onClick={() => confirmRole(u, 'user')}
              />
            )}
            {!isMe && (
              <Button
                variant="outlined"
                intent="danger"
                icon="delete"
                size="sm"
                disabled={isBusy}
                tooltip="Delete"
                onClick={() => confirmDelete(u)}
              />
            )}
            {isMe && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>You</span>}
          </div>
        );
      },
    },
  ];
};
