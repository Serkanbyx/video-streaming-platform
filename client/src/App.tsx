import { type ComponentType, type ReactElement } from 'react';
import {
  RouterProvider,
  createBrowserRouter,
  type RouteObject,
} from 'react-router-dom';

import { AdminLayout } from './components/layout/AdminLayout.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { SettingsLayout } from './components/layout/SettingsLayout.js';

import { AdminRoute } from './components/guards/AdminRoute.js';
import { CreatorRoute } from './components/guards/CreatorRoute.js';
import { GuestOnlyRoute } from './components/guards/GuestOnlyRoute.js';
import { ProtectedRoute } from './components/guards/ProtectedRoute.js';

import { ChannelPage } from './pages/ChannelPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { HomePage } from './pages/HomePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { StudioPage } from './pages/StudioPage.js';
import { SubscriptionsPage } from './pages/SubscriptionsPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { VideoDetailPage } from './pages/VideoDetailPage.js';

import { AdminCommentsPage } from './pages/admin/AdminCommentsPage.js';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.js';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.js';
import { AdminVideosPage } from './pages/admin/AdminVideosPage.js';

import { AccountSettingsPage } from './pages/settings/AccountSettingsPage.js';
import { AppearanceSettingsPage } from './pages/settings/AppearanceSettingsPage.js';
import { NotificationSettingsPage } from './pages/settings/NotificationSettingsPage.js';
import { PrivacySettingsPage } from './pages/settings/PrivacySettingsPage.js';
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage.js';

interface RouteEntry {
  path: string;
  element: ReactElement;
  guard?: ComponentType;
}

const mainRoutes: readonly RouteEntry[] = [
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage />, guard: GuestOnlyRoute },
  { path: '/register', element: <RegisterPage />, guard: GuestOnlyRoute },
  { path: '/v/:videoId', element: <VideoDetailPage /> },
  { path: '/upload', element: <UploadPage />, guard: CreatorRoute },
  { path: '/studio', element: <StudioPage />, guard: CreatorRoute },
  { path: '/c/:username', element: <ChannelPage /> },
  { path: '/me', element: <ProfilePage />, guard: ProtectedRoute },
  { path: '/me/history', element: <HistoryPage />, guard: ProtectedRoute },
  { path: '/me/subscriptions', element: <SubscriptionsPage />, guard: ProtectedRoute },
];

const settingsRoutes: readonly RouteEntry[] = [
  { path: '/settings/profile', element: <ProfileSettingsPage />, guard: ProtectedRoute },
  { path: '/settings/account', element: <AccountSettingsPage />, guard: ProtectedRoute },
  { path: '/settings/appearance', element: <AppearanceSettingsPage /> },
  { path: '/settings/privacy', element: <PrivacySettingsPage />, guard: ProtectedRoute },
  { path: '/settings/notifications', element: <NotificationSettingsPage />, guard: ProtectedRoute },
];

const adminRoutes: readonly RouteEntry[] = [
  { path: '/admin', element: <AdminDashboardPage /> },
  { path: '/admin/users', element: <AdminUsersPage /> },
  { path: '/admin/videos', element: <AdminVideosPage /> },
  { path: '/admin/comments', element: <AdminCommentsPage /> },
];

/**
 * Wrap a leaf route in its guard component (which renders an `<Outlet />` once
 * authorization passes). Returning a single nested config keeps the leaf
 * declaration uniform whether or not a guard is present.
 */
const wrapWithGuard = ({ path, element, guard: Guard }: RouteEntry): RouteObject => {
  if (!Guard) return { path, element };
  return {
    element: <Guard />,
    children: [{ path, element }],
  };
};

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: mainRoutes.map(wrapWithGuard),
  },
  {
    element: <SettingsLayout />,
    children: settingsRoutes.map(wrapWithGuard),
  },
  {
    element: <AdminLayout />,
    children: [
      {
        element: <AdminRoute />,
        children: adminRoutes.map(({ path, element }) => ({ path, element })),
      },
    ],
  },
  {
    element: <MainLayout />,
    children: [{ path: '*', element: <NotFoundPage /> }],
  },
]);

export const App = () => <RouterProvider router={router} />;

export default App;
