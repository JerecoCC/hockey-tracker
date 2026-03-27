import { Outlet } from 'react-router-dom';
import AdminNav from '../AdminNav/AdminNav';
import styles from './AdminLayout.module.scss';

const AdminLayout = () => (
  <div className={styles.page}>
    <AdminNav />
    <Outlet />
  </div>
);

export default AdminLayout;
