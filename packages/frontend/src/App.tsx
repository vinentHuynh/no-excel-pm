import { Center, Loader, MantineProvider, Stack, Text } from '@mantine/core';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import {
  Navigate,
  createBrowserRouter,
  RouterProvider,
} from 'react-router-dom';
import { Navigation } from './components/Navigation';
import DashboardPage from './pages/Dashboard';
import SprintPage from './pages/Sprint';
import BacklogPage from './pages/Backlog';
import LoginPage from './pages/Login';

const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      {
        path: '/',
        element: <DashboardPage />,
      },
      {
        path: '/sprint',
        element: <SprintPage />,
      },
      {
        path: '/backlog',
        element: <BacklogPage />,
      },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
]);

function ProtectedLayout() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  if (authStatus === 'configuring') {
    return (
      <Center h='100vh'>
        <Stack align='center' gap='xs'>
          <Loader />
          <Text size='sm' c='dimmed'>
            Loading your session…
          </Text>
        </Stack>
      </Center>
    );
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return <Navigation />;
}

function App() {
  return (
    <MantineProvider
      theme={{
        fontFamily:
          "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
        headings: {
          fontFamily:
            "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
          fontWeight: '600',
        },
        primaryColor: 'indigo',
        defaultRadius: 'md',
      }}
      defaultColorScheme='dark'
    >
      <Authenticator.Provider>
        <RouterProvider router={router} />
      </Authenticator.Provider>
    </MantineProvider>
  );
}

export default App;
