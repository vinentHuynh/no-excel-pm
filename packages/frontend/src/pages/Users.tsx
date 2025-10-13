import { useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member';
}

const roleOptions: Array<UserRecord['role']> = ['Owner', 'Admin', 'Member'];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([
    {
      id: '1',
      name: 'Taylor Nguyen',
      email: 'taylor@spectrumvoip.com',
      role: 'Owner',
    },
    {
      id: '2',
      name: 'Sam Patel',
      email: 'sam@spectrumvoip.com',
      role: 'Admin',
    },
  ]);

  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    role: 'Member' as UserRecord['role'],
  });

  const addUser = () => {
    const trimmedName = formValues.name.trim();
    const trimmedEmail = formValues.email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      return;
    }

    const exists = users.some((user) => user.email === trimmedEmail);
    if (exists) {
      return;
    }

    setUsers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: trimmedName,
        email: trimmedEmail,
        role: formValues.role,
      },
    ]);

    setFormValues({ name: '', email: '', role: 'Member' });
  };

  const removeUser = (id: string) => {
    setUsers((current) => current.filter((user) => user.id !== id));
  };

  const userRows = users.map((user) => (
    <Table.Tr key={user.id}>
      <Table.Td>{user.name}</Table.Td>
      <Table.Td>{user.email}</Table.Td>
      <Table.Td>{user.role}</Table.Td>
      <Table.Td width={48}>
        <ActionIcon
          variant='subtle'
          color='red'
          aria-label={`Remove ${user.name}`}
          onClick={() => removeUser(user.id)}
        >
          <IconTrash size={16} stroke={1.5} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap='lg'>
      <Title order={1}>Workspace users</Title>
      <Text size='sm' c='dimmed'>
        Manage who can access Paroview. This demo view stores changes locally;
        connect it to your backend or Cognito APIs to persist updates.
      </Text>

      <Paper withBorder p='md' radius='md'>
        <Stack gap='md'>
          <Title order={3}>Invite a teammate</Title>
          <Group gap='md' align='flex-end' wrap='wrap'>
            <TextInput
              label='Name'
              placeholder='Taylor Nguyen'
              value={formValues.name}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  name: event.currentTarget.value,
                }))
              }
              style={{ flex: 1, minWidth: 200 }}
            />
            <TextInput
              label='Business email'
              placeholder='you@company.com'
              value={formValues.email}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  email: event.currentTarget.value,
                }))
              }
              style={{ flex: 1, minWidth: 240 }}
            />
            <Select
              label='Role'
              data={roleOptions}
              value={formValues.role}
              onChange={(value) =>
                setFormValues((current) => ({
                  ...current,
                  role: (value as UserRecord['role']) ?? current.role,
                }))
              }
              style={{ width: 180 }}
            />
            <Button onClick={addUser}>Add user</Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder radius='md' p='md'>
        <Box style={{ overflowX: 'auto' }}>
          <Table highlightOnHover withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th aria-label='Actions'>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{userRows}</Table.Tbody>
          </Table>
        </Box>
      </Paper>
    </Stack>
  );
}
