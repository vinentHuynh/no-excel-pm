import {
  AppShell,
  Burger,
  Button,
  Group,
  NavLink,
  Text,
  ActionIcon,
  Tooltip,
  Stack,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  IconSun,
  IconMoon,
  IconLayoutDashboard,
  IconBrandStackshare,
  IconListCheck,
  IconChevronLeft,
  IconChevronRight,
  IconUsers,
} from '@tabler/icons-react';

export function Navigation() {
  const [mobileOpened, mobileHandlers] = useDisclosure(false);
  const [desktopCollapsed, desktopHandlers] = useDisclosure(false);
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const navigate = useNavigate();
  const location = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');

  const navbarWidth = desktopCollapsed ? 72 : 280;

  const navigationItems = [
    {
      label: 'Dashboard',
      to: '/',
      icon: IconLayoutDashboard,
    },
    {
      label: 'Sprint',
      to: '/sprint',
      icon: IconBrandStackshare,
    },
    {
      label: 'Backlogs',
      to: '/backlog',
      icon: IconListCheck,
    },
    {
      label: 'Users',
      to: '/users',
      icon: IconUsers,
    },
  ];

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
      navbar={{
        width: navbarWidth,
        breakpoint: 'sm',
        collapsed: {
          mobile: !mobileOpened,
        },
      }}
      padding='md'
    >
      <AppShell.Header>
        <Group h='100%' px='md' justify='space-between'>
          <Group gap='sm'>
            <Burger
              opened={mobileOpened}
              onClick={mobileHandlers.toggle}
              hiddenFrom='sm'
              size='sm'
            />
            <Text fw={600}>Paroview</Text>
          </Group>
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

      <AppShell.Navbar p='md' style={{ display: 'flex', flexDirection: 'column' }}>
        <Stack gap='xs' style={{ flex: 1 }}>
          {navigationItems.map(({ label, to, icon: Icon }) => {
            const link = (
              <NavLink
                key={label}
                label={desktopCollapsed ? undefined : label}
                component={Link}
                to={to}
                leftSection={<Icon size={18} stroke={1.5} />}
                aria-label={label}
                active={location.pathname === to}
              />
            );

            if (!desktopCollapsed) {
              return link;
            }

            return (
              <Tooltip key={label} label={label} position='right'>
                {link}
              </Tooltip>
            );
          })}
        </Stack>
        <Tooltip
          label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          position='right'
        >
          <ActionIcon
            variant='subtle'
            size='lg'
            onClick={desktopHandlers.toggle}
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {desktopCollapsed ? (
              <IconChevronRight size={18} stroke={1.5} />
            ) : (
              <IconChevronLeft size={18} stroke={1.5} />
            )}
          </ActionIcon>
        </Tooltip>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
