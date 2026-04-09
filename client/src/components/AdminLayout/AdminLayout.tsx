import { Outlet } from 'react-router-dom';
import AdminNav from '../AdminNav/AdminNav';
import styles from './AdminLayout.module.scss';

const AdminLayout = () => (
  <div className={styles.page}>
    <AdminNav />
    <div className={styles.scrollArea}>
      <Outlet />
    </div>
  </div>
);

export default AdminLayout;
