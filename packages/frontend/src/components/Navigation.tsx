import {
  AppShell,
  Burger,
  Button,
  Group,
  NavLink,
  Text,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { IconSun, IconMoon } from '@tabler/icons-react';

export function Navigation() {
  const [opened, { toggle }] = useDisclosure();
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const navigate = useNavigate();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');

  const displayName =
    user?.signInDetails?.loginId ?? user?.username ?? user?.userId ?? 'User';

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login');
    }
  };

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
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
            <ActionIcon
              variant='default'
              size='lg'
              onClick={toggleColorScheme}
              title={`Switch to ${
                computedColorScheme === 'dark' ? 'light' : 'dark'
              } mode`}
            >
              {computedColorScheme === 'dark' ? (
                <IconSun size={18} stroke={1.5} />
              ) : (
                <IconMoon size={18} stroke={1.5} />
              )}
            </ActionIcon>
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
