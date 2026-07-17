import AppLayout from '@/shared/AppLayout/AppLayout';
import UserNav from '@/shared/UserNav/UserNav';

const UserLayout = () => <AppLayout renderNavigation={(props) => <UserNav {...props} />} />;

export default UserLayout;
