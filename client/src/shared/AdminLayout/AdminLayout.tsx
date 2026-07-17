import AdminNav from '@/shared/AdminNav/AdminNav';
import AppLayout from '@/shared/AppLayout/AppLayout';

const AdminLayout = () => (
  <AppLayout renderNavigation={(props) => <AdminNav {...props} />} />
);

export default AdminLayout;
