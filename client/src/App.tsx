import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { ThemeProvider } from './context/ThemeProvider';
import LoginPage from './pages/login/Login';
import SignupPage from './pages/signup/Signup';
import AdminLayout from './components/AdminLayout/AdminLayout';
import UserLayout from './components/UserLayout/UserLayout';
import UserDashboard from './pages/user/dashboard/UserDashboard';
import UserGames from './pages/user/games/UserGames';
import UserGameDetailsPage from './pages/user/games/game-details/UserGameDetailsPage';
import UserSettings from './pages/user/settings/UserSettings';
import LeaguesPage from './pages/admin/leagues/Leagues';
import LeagueDetailsPage from './pages/admin/leagues/LeagueDetails';
import UsersPage from './pages/admin/users/Users';
import TeamDetailsPage from './pages/admin/teams/TeamDetails';
import SeasonDetailsPage from './pages/admin/seasons/SeasonDetails';
import PlayoffSeriesDetailsPage from './pages/admin/seasons/PlayoffSeriesDetailsPage';
import GameDetailsPage from './pages/admin/games/game-details/GameDetailsPage';
import PlayerDetailsPage from './pages/admin/players/PlayerDetails';
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
    element: (
      <PrivateRoute>
        <UserLayout />
      </PrivateRoute>
    ),
    children: [
      { path: '/dashboard', element: <UserDashboard /> },
      { path: '/games', element: <UserGames /> },
      { path: '/games/:id', element: <UserGameDetailsPage /> },
      { path: '/settings', element: <UserSettings /> },
    ],
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
      { path: '/admin/leagues/:leagueSlug', element: <LeagueDetailsPage /> },
      { path: '/admin/leagues/:leagueSlug/teams/:teamSlug', element: <TeamDetailsPage /> },
      { path: '/admin/leagues/:leagueSlug/seasons/:seasonSlug', element: <SeasonDetailsPage /> },
      {
        path: '/admin/leagues/:leagueSlug/seasons/:seasonSlug/playoffs/:seriesSlug',
        element: <PlayoffSeriesDetailsPage />,
      },
      {
        path: '/admin/leagues/:leagueSlug/seasons/:seasonSlug/games/:gameDateSlug/:gameSlug',
        element: <GameDetailsPage />,
      },
      {
        path: '/admin/leagues/:leagueSlug/seasons/:seasonSlug/games/:gameSlug',
        element: <GameDetailsPage />,
      },
      {
        path: '/admin/leagues/:leagueCode/teams/:teamCode/players/:playerSlug',
        element: <PlayerDetailsPage />,
      },
      {
        path: '/admin/leagues/:leagueCode/players/:playerSlug',
        element: <PlayerDetailsPage />,
      },
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

const AppShell = () => {
  const { theme } = useTheme();

  return (
    <AuthProvider>
      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        hideProgressBar
        theme={theme}
      />
      <RouterProvider router={router} />
    </AuthProvider>
  );
};

const App = () => (
  <ThemeProvider>
    <AppShell />
  </ThemeProvider>
);

export default App;
