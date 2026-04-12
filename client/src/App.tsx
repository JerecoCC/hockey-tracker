import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
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

const App = () => (
  <AuthProvider>
    <ToastContainer
      position="bottom-right"
      autoClose={4000}
      theme="colored"
    />
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />
        <Route
          path="/auth/callback"
          element={<AuthCallbackPage />}
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route
            path="/admin"
            element={
              <Navigate
                to="/admin/leagues"
                replace
              />
            }
          />
          <Route
            path="/admin/leagues"
            element={<LeaguesPage />}
          />
          <Route
            path="/admin/users"
            element={<UsersPage />}
          />
          <Route
            path="/admin/leagues/:id"
            element={<LeagueDetailsPage />}
          />
          <Route
            path="/admin/leagues/:leagueId/teams/:id"
            element={<TeamDetailsPage />}
          />
        </Route>
        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
