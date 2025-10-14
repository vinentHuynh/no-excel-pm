import { useState, useEffect } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Alert,
  Loader,
  Center,
  Select,
} from '@mantine/core';
import { IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import type { UserProfile } from '../../../shared/types';

type UserRole = 'admin' | 'member';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    role: 'member' as UserRole,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUsers();
      setUsers(response.users);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    const trimmedName = formValues.name.trim();
    const trimmedEmail = formValues.email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setError('Name and email are required');
      return;
    }

    const exists = users.some((user) => user.email === trimmedEmail);
    if (exists) {
      setError('A user with this email already exists');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await apiClient.createUser({
        name: trimmedName,
        email: trimmedEmail,
        role: formValues.role,
      });

      setUsers((current) => [...current, response.user]);
      setFormValues({ name: '', email: '', role: 'member' });
    } catch (err) {
      console.error('Error adding user:', err);
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  const removeUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) {
      return;
    }

    try {
      setError(null);
      await apiClient.deleteUser(userId);
      setUsers((current) => current.filter((user) => user.userId !== userId));
    } catch (err) {
      console.error('Error removing user:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    }
  };

  if (loading) {
    return (
      <Center h={400}>
        <Stack align='center' gap='xs'>
          <Loader />
          <Text size='sm' c='dimmed'>
            Loading users...
          </Text>
        </Stack>
      </Center>
    );
  }

  const userRows = users.map((user) => (
    <Table.Tr key={user.userId}>
      <Table.Td>{user.name}</Table.Td>
      <Table.Td>{user.email}</Table.Td>
      <Table.Td style={{ textTransform: 'capitalize' }}>{user.role}</Table.Td>
      <Table.Td width={48}>
        <ActionIcon
          variant='subtle'
          color='red'
          aria-label={`Remove ${user.name}`}
          onClick={() => removeUser(user.userId)}
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
        Manage who can access your workspace. Users are stored in DynamoDB and
        isolated by domain.
      </Text>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title='Error'
          color='red'
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Paper withBorder p='md' radius='md'>
        <Stack gap='md'>
          <Title order={3}>Invite a teammate</Title>
          <Group gap='md' align='flex-end' wrap='wrap'>
            <TextInput
              label='Name'
              value={formValues.name}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFormValues((current) => ({
                  ...current,
                  name: value,
                }));
              }}
              style={{ flex: 1, minWidth: 200 }}
            />
            <TextInput
              label='Business email'
              value={formValues.email}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFormValues((current) => ({
                  ...current,
                  email: value,
                }));
              }}
              style={{ flex: 1, minWidth: 240 }}
            />
            <Select
              label='Role'
              data={[
                { value: 'admin', label: 'Admin' },
                { value: 'member', label: 'Member' },
              ]}
              value={formValues.role}
              onChange={(value) => {
                if (value === 'admin' || value === 'member') {
                  setFormValues((current) => ({
                    ...current,
                    role: value,
                  }));
                }
              }}
              style={{ width: 180 }}
            />
            <Button onClick={addUser} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add user'}
            </Button>
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
