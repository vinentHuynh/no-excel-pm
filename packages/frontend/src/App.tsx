import { MantineProvider } from '@mantine/core';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import DashboardPage from './pages/Dashboard';
import SprintPage from './pages/Sprint';
import BacklogPage from './pages/Backlog';
import LoginPage from './pages/Login';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigation />,
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

function App() {
  return (
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>
  );
}

export default App;
