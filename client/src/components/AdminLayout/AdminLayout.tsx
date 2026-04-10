import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminNav from '../AdminNav/AdminNav';
import Icon from '../Icon/Icon';
import PageHeader from '../PageHeader/PageHeader';
import styles from './AdminLayout.module.scss';

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.sidebarWrapper}>
        <AdminNav
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
        <button
          className={styles.sidebarToggle}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon
            name={collapsed ? 'chevron_right' : 'chevron_left'}
            size="0.75rem"
          />
        </button>
      </div>
      <div className={styles.scrollArea}>
        <PageHeader />
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
