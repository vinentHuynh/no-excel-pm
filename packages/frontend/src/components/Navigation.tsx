import { AppShell, Burger, Group, NavLink } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet } from 'react-router-dom';

export function Navigation() {
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding='md'
    >
      <AppShell.Header>
        <Group h='100%' px='md'>
          <Burger opened={opened} onClick={toggle} hiddenFrom='sm' size='sm' />
          <div>No Excel PM</div>
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
