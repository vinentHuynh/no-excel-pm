import {
  ActionIcon,
  AppShell,
  Badge,
  Burger,
  Button,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import SprintPage from './Sprint';
import { getDemoTasks } from '../demo/demoTasks';

export default function DemoPage() {
  const [opened, { toggle }] = useDisclosure();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');
  const demoTasks = useMemo(() => getDemoTasks(), []);

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
          <Group gap='xs'>
            <Title order={4}>Paroview</Title>
            <Badge color='lime' variant='light'>
              Demo mode
            </Badge>
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
            <Button size='xs' variant='light' component={Link} to='/login'>
              Back to login
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p='md'>
        <Stack gap='xs'>
          <Text size='sm' c='dimmed'>
            Explore the Paroview workspace with sample data.
          </Text>
          <NavLink label='Dashboard' component='button' disabled />
          <NavLink label='Sprint' component='button' active />
          <NavLink label='Backlog' component='button' disabled />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <SprintPage demoMode demoTasks={demoTasks} />
      </AppShell.Main>
    </AppShell>
  );
}
