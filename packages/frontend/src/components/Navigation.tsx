import { AppShell, Burger, Button, Group, NavLink, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

export function Navigation() {
  const [opened, { toggle }] = useDisclosure();
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const navigate = useNavigate();

  const displayName =
    user?.signInDetails?.loginId ?? user?.username ?? user?.userId ?? 'User';

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login');
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding='md'
    >
      <AppShell.Header>
        <Group h='100%' px='md' justify='space-between'>
          <Burger opened={opened} onClick={toggle} hiddenFrom='sm' size='sm' />
          <Text fw={600}>No Excel PM</Text>
          <Group gap='xs'>
            <Text size='sm' c='dimmed'>
              Signed in as {displayName}
            </Text>
            <Button size='xs' variant='light' onClick={handleSignOut}>
              Sign out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p='md'>
        <NavLink label='Dashboard' component={Link} to='/' />
        <NavLink label='Sprint' component={Link} to='/sprint' />
        <NavLink label='Backlogs' component={Link} to='/backlog' />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
