import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Suspense, lazy, type ReactNode } from 'react';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { ThemeProvider } from './context/ThemeProvider';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';

const LoginPage = lazy(() => import('./pages/login/Login'));
const SignupPage = lazy(() => import('./pages/signup/Signup'));
const AuthCallbackPage = lazy(() => import('./pages/auth/callback/AuthCallback'));

const AdminLayout = lazy(() => import('./components/AdminLayout/AdminLayout'));
const UserLayout = lazy(() => import('./components/UserLayout/UserLayout'));

const UserDashboard = lazy(() => import('./pages/user/dashboard/UserDashboard'));
const UserGames = lazy(() => import('./pages/user/games/UserGames'));
const UserGamesWatched = lazy(() => import('./pages/user/games-watched/UserGamesWatched'));
const UserGamesWatchedTeam = lazy(
  () => import('./pages/user/games-watched/UserGamesWatchedTeam'),
);
const UserGameDetailsPage = lazy(
  () => import('./pages/user/games/game-details/UserGameDetailsPage'),
);
const UserTeamDetailsPage = lazy(() => import('./pages/user/teams/UserTeamDetailsPage'));
const UserSettings = lazy(() => import('./pages/user/settings/UserSettings'));

const LeaguesPage = lazy(() => import('./pages/admin/leagues/Leagues'));
const LeagueDetailsPage = lazy(() => import('./pages/admin/leagues/LeagueDetails'));
const UsersPage = lazy(() => import('./pages/admin/users/Users'));
const TeamDetailsPage = lazy(() => import('./pages/admin/teams/TeamDetails'));
const SeasonDetailsPage = lazy(() => import('./pages/admin/seasons/SeasonDetails'));
const PlayoffSeriesDetailsPage = lazy(
  () => import('./pages/admin/seasons/PlayoffSeriesDetailsPage'),
);
const GameDetailsPage = lazy(() => import('./pages/admin/games/game-details/GameDetailsPage'));
const PlayerDetailsPage = lazy(() => import('./pages/admin/players/PlayerDetails'));

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
      { path: '/dashboard/games-watched', element: <UserGamesWatched /> },
      { path: '/dashboard/games-watched/:teamSlug', element: <UserGamesWatchedTeam /> },
      { path: '/games', element: <UserGames /> },
      {
        path: '/games/watched',
        element: (
          <Navigate
            to="/dashboard/games-watched"
            replace
          />
        ),
      },
      { path: '/games/:gameDateSlug/:gameSlug', element: <UserGameDetailsPage /> },
      { path: '/games/:id', element: <UserGameDetailsPage /> },
      { path: '/leagues/:leagueSlug/teams/:teamSlug', element: <UserTeamDetailsPage /> },
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
      <Suspense
        fallback={
          <LoadingSpinner
            layout="page"
            size="lg"
          />
        }
      >
        <RouterProvider router={router} />
      </Suspense>
    </AuthProvider>
  );
};

const App = () => (
  <ThemeProvider>
    <AppShell />
  </ThemeProvider>
);

export default App;
