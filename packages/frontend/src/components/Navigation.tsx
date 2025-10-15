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
  Center,
  Loader,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth';
import {
  IconSun,
  IconMoon,
  // IconLayoutDashboard,
  IconBrandStackshare,
  // IconListCheck,
  IconChevronLeft,
  IconChevronRight,
  IconUsers,
  IconTicket,
} from '@tabler/icons-react';

export function Navigation() {
  const [mobileOpened, mobileHandlers] = useDisclosure(false);
  const [desktopCollapsed, desktopHandlers] = useDisclosure(false);
  const { user, authStatus } = useAuthenticator((context) => [
    context.user,
    context.authStatus,
  ]);
  const location = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');
  const [resolvedDisplayName, setResolvedDisplayName] =
    useState<string>('User');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const navbarWidth = desktopCollapsed ? 72 : 280;

  const navigationItems = useMemo(
    () => [
      // {
      //   label: 'Dashboard',
      //   to: '/',
      //   icon: IconLayoutDashboard,
      // },
      {
        label: 'Projects',
        to: '/sprint',
        icon: IconBrandStackshare,
      },

      // {
      //   label: 'Backlogs',
      //   to: '/backlog',
      //   icon: IconListCheck,
      // },
      {
        label: 'Users',
        to: '/users',
        icon: IconUsers,
      },
      {
        label: 'Support Tickets',
        to: '/tickets',
        icon: IconTicket,
      },
    ],
    []
  );

  useEffect(() => {
    console.debug('Navigation authStatus changed', {
      authStatus,
      hasUser: Boolean(user),
    });

    if (authStatus !== 'authenticated') {
      setResolvedDisplayName('User');
      return;
    }

    let cancelled = false;

    const resolveName = async () => {
      // Try to get name from user object if available
      const immediateName =
        user?.signInDetails?.loginId ?? user?.username ?? user?.userId ?? '';

      if (immediateName) {
        setResolvedDisplayName(immediateName);
      }

      // Always try to fetch from session tokens, even if user object doesn't exist
      try {
        const session = await fetchAuthSession();
        if (cancelled) {
          return;
        }

        const payload = session.tokens?.idToken?.payload ?? {};
        const pickValue = (key: string) => {
          const value = (payload as Record<string, unknown>)[key];
          return typeof value === 'string' ? value : undefined;
        };

        const derivedName =
          pickValue('email') ??
          pickValue('name') ??
          pickValue('cognito:username') ??
          pickValue('preferred_username') ??
          (immediateName ? immediateName : undefined) ??
          'User';

        setResolvedDisplayName(derivedName);
      } catch (error) {
        console.error('Failed to resolve signed-in user', error);
        if (!cancelled) {
          setResolvedDisplayName(immediateName || 'User');
        }
      }
    };

    resolveName();

    return () => {
      cancelled = true;
    };
  }, [user, authStatus]);

  // Reset signing out state when auth status changes
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setSigningOut(false);
      setSignOutError(null);
    }
  }, [authStatus]);

  const displayName = resolvedDisplayName.trim() || 'User';

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }

    console.debug('Navigation sign out requested', {
      signingOut,
      path: location.pathname,
      authStatus,
      hasUser: Boolean(user),
    });

    setSignOutError(null);
    setSigningOut(true);

    try {
      // Use the low-level signOut function from aws-amplify/auth
      await amplifySignOut({ global: true });
      mobileHandlers.close();
      desktopHandlers.close();
      console.debug('Navigation sign out completed successfully');

      // Force a page reload to clear all auth state
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to sign out', error);
      setSignOutError(
        'Something went wrong signing you out. Please try again.'
      );
      setSigningOut(false);
    }
  };

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  // Don't render if not authenticated
  if (authStatus !== 'authenticated') {
    return (
      <Center h='100vh'>
        <Stack align='center' gap='xs'>
          <Loader />
          <Text size='sm' c='dimmed'>
            Loading...
          </Text>
        </Stack>
      </Center>
    );
  }

  // Render immediately if authenticated, don't wait for user object
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
            <Stack gap={4} align='flex-end'>
              <Button
                size='xs'
                variant='light'
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
              {signOutError ? (
                <Text size='xs' c='red.5'>
                  {signOutError}
                </Text>
              ) : null}
            </Stack>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p='md'
        style={{ display: 'flex', flexDirection: 'column' }}
      >
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
            aria-label={
              desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
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
