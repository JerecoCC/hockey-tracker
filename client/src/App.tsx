import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/login/Login';
import SignupPage from './pages/signup/Signup';
import DashboardPage from './pages/dashboard/Dashboard';
import AdminLayout from './components/AdminLayout/AdminLayout';
import LeaguesPage from './pages/admin/leagues/Leagues';
import LeagueDetailsPage from './pages/admin/leagues/LeagueDetails';
import UsersPage from './pages/admin/users/Users';
import TeamDetailsPage from './pages/admin/teams/TeamDetails';
import SeasonDetailsPage from './pages/admin/seasons/SeasonDetails';
import AuthCallbackPage from './pages/auth/callback/AuthCallback';

const PrivateRoute = (props: { children: ReactNode }) => {
  const { children } = props;
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? (
    <>{children}</>
  ) : (
    <Navigate
      to="/login"
      replace
    />
  );
};

const PublicRoute = (props: { children: ReactNode }) => {
  const { children } = props;
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? (
    <Navigate
      to="/dashboard"
      replace
    />
  ) : (
    <>{children}</>
  );
};

const AdminRoute = (props: { children: ReactNode }) => {
  const { children } = props;
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  if (user.role !== 'admin')
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  return <>{children}</>;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Navigate
        to="/login"
        replace
      />
    ),
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: '/signup',
    element: (
      <PublicRoute>
        <SignupPage />
      </PublicRoute>
    ),
  },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  {
    path: '/dashboard',
    element: (
      <PrivateRoute>
        <DashboardPage />
      </PrivateRoute>
    ),
  },
  {
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    children: [
      {
        path: '/admin',
        element: (
          <Navigate
            to="/admin/leagues"
            replace
          />
        ),
      },
      { path: '/admin/leagues', element: <LeaguesPage /> },
      { path: '/admin/users', element: <UsersPage /> },
      { path: '/admin/leagues/:id', element: <LeagueDetailsPage /> },
      { path: '/admin/leagues/:leagueId/teams/:id', element: <TeamDetailsPage /> },
      { path: '/admin/leagues/:leagueId/seasons/:id', element: <SeasonDetailsPage /> },
    ],
  },
  {
    path: '*',
    element: (
      <Navigate
        to="/login"
        replace
      />
    ),
  },
]);

const App = () => (
  <AuthProvider>
    <ToastContainer
      position="bottom-right"
      autoClose={4000}
      theme="colored"
    />
    <RouterProvider router={router} />
  </AuthProvider>
);

export default App;
