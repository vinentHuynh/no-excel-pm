import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SegmentedControl,
  Stack,
  TextInput,
  Textarea,
  Text,
  Title,
} from '@mantine/core';
import { apiClient } from '../api/client';
import type { Ticket, TicketStatus, TicketType } from '../../../shared/types';

const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New',
  'in-progress': 'In Progress',
  done: 'Done',
};

const STATUS_ORDER: TicketStatus[] = ['new', 'in-progress', 'done'];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus>('new');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    type: 'feature' as TicketType,
    status: 'new' as TicketStatus,
  });

  useEffect(() => {
    let cancelled = false;

    const loadTasks = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.getTickets();
        if (!cancelled) {
          setTickets(response.tickets);
        }
      } catch (err) {
        console.error('Failed to load tickets', err);
        const message =
          err instanceof Error ? err.message : 'Unable to load tickets.';
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    return tickets.reduce(
      (acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] ?? 0) + 1;
        return acc;
      },
      {
        new: 0,
        'in-progress': 0,
        done: 0,
      } as Record<TicketStatus, number>
    );
  }, [tickets]);

  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === statusFilter),
    [tickets, statusFilter]
  );

  const handleOpenCreate = () => {
    resetNewTicket();
    setCreateModalOpen(true);
  };

  const resetNewTicket = () => {
    setNewTicket({
      title: '',
      description: '',
      type: 'feature' as TicketType,
      status: 'new' as TicketStatus,
    });
  };

  const handleCloseCreate = () => {
    if (createLoading) {
      return;
    }
    setCreateModalOpen(false);
    resetNewTicket();
  };

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = newTicket.title.trim();
    const trimmedDescription = newTicket.description.trim();

    if (!trimmedTitle) {
      setError('Title is required to create a ticket.');
      return;
    }

    setError(null);
    setCreateLoading(true);

    try {
      const response = await apiClient.createTicket({
        title: trimmedTitle,
        description: trimmedDescription ? trimmedDescription : undefined,
        status: newTicket.status,
        type: newTicket.type,
      });

      setTickets((previous) => [...previous, response.ticket]);
      setStatusFilter(response.ticket.status);
      resetNewTicket();
      setCreateModalOpen(false);
      setError(null);
    } catch (err) {
      console.error('Failed to create ticket', err);
      const message =
        err instanceof Error ? err.message : 'Unable to create ticket.';
      setError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusUpdate = async (
    ticket: Ticket,
    nextStatus: TicketStatus
  ) => {
    if (ticket.status === nextStatus || updatingTicketId) {
      return;
    }

    setUpdatingTicketId(ticket.id);
    setError(null);

    try {
      await apiClient.updateTicket(ticket.id, { status: nextStatus });
      setTickets((previous) =>
        previous.map((existing) =>
          existing.id === ticket.id
            ? { ...existing, status: nextStatus }
            : existing
        )
      );
    } catch (err) {
      console.error('Failed to update ticket status', err);
      const message =
        err instanceof Error ? err.message : 'Unable to update ticket status.';
      setError(message);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  if (loading) {
    return (
      <Center h='100vh'>
        <Stack align='center' gap='xs'>
          <Loader />
          <Text size='sm' c='dimmed'>
            Loading tickets…
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <Modal
        opened={createModalOpen}
        onClose={handleCloseCreate}
        title='Create Ticket'
        centered
        closeOnClickOutside={!createLoading}
        closeOnEscape={!createLoading}
        withCloseButton
      >
        <form onSubmit={handleCreateTicket}>
          <Stack gap='md'>
            <TextInput
              label='Title'
              placeholder='Short summary'
              required
              value={newTicket.title}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                if (error === 'Title is required to create a ticket.') {
                  setError(null);
                }
                setNewTicket((previous) => ({
                  ...previous,
                  title: nextValue,
                }));
              }}
              disabled={createLoading}
            />
            <Textarea
              label='Description'
              placeholder='Additional details'
              minRows={3}
              resize='vertical'
              value={newTicket.description}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                if (error === 'Title is required to create a ticket.') {
                  setError(null);
                }
                setNewTicket((previous) => ({
                  ...previous,
                  description: nextValue,
                }));
              }}
              disabled={createLoading}
            />
            <Select
              label='Type'
              data={[
                { value: 'feature', label: 'Feature' },
                { value: 'bug', label: 'Bug' },
              ]}
              value={newTicket.type}
              onChange={(value) => {
                if (!value) {
                  return;
                }
                setNewTicket((previous) => ({
                  ...previous,
                  type: value as TicketType,
                }));
              }}
              required
              disabled={createLoading}
            />
            <Select
              label='Status'
              data={STATUS_ORDER.map((status) => ({
                value: status,
                label: STATUS_LABELS[status],
              }))}
              value={newTicket.status}
              onChange={(value) => {
                if (!value) {
                  return;
                }
                setNewTicket((previous) => ({
                  ...previous,
                  status: value as TicketStatus,
                }));
              }}
              disabled={createLoading}
            />
            <Group justify='flex-end' gap='sm'>
              <Button
                type='button'
                variant='default'
                onClick={handleCloseCreate}
                disabled={createLoading}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                loading={createLoading}
                disabled={!newTicket.title.trim()}
              >
                Create Ticket
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Stack gap='lg'>
        <Stack gap={4}>
          <Title order={2}>Support Tickets</Title>
          <Text size='sm' c='dimmed'>
            Tickets to track bugs and features of Paroview
          </Text>
        </Stack>

        {error ? (
          <Alert color='red' variant='light' title='Unable to load tickets'>
            {error}
          </Alert>
        ) : null}

        <Paper withBorder p='md' radius='md'>
          <Group justify='space-between' align='center'>
            <Group align='center' gap='sm'>
              <SegmentedControl
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as TicketStatus)}
                data={STATUS_ORDER.map((status) => ({
                  value: status,
                  label: `${STATUS_LABELS[status]} (${counts[status] ?? 0})`,
                }))}
              />
              <Badge color='gray' variant='light'>
                {tickets.length} total
              </Badge>
            </Group>
            <Button onClick={handleOpenCreate}>New Ticket</Button>
          </Group>
        </Paper>

        <Stack gap='md'>
          {filteredTickets.length === 0 ? (
            <Card withBorder radius='md' p='lg'>
              <Stack gap='xs' align='center'>
                <Text size='sm' c='dimmed'>
                  No tickets are currently labeled as{' '}
                  {STATUS_LABELS[statusFilter]}.
                </Text>
                <Text size='xs' c='dimmed'>
                  Switch tabs to view other statuses or adjust a ticket from
                  your backlog.
                </Text>
              </Stack>
            </Card>
          ) : (
            filteredTickets.map((ticketItem) => (
              <Card key={ticketItem.id} withBorder radius='md' p='md'>
                <Stack gap='sm'>
                  <Group justify='space-between' align='flex-start'>
                    <Stack gap={4}>
                      <Text fw={600}>{ticketItem.title}</Text>
                      {ticketItem.description ? (
                        <Text size='sm' c='dimmed'>
                          {ticketItem.description}
                        </Text>
                      ) : null}
                      <Group gap='xs'>
                        <Badge
                          color={ticketItem.type === 'bug' ? 'red' : 'teal'}
                          variant='light'
                        >
                          {ticketItem.type === 'bug' ? 'Bug' : 'Feature'}
                        </Badge>
                        <Badge color='indigo' variant='light'>
                          {STATUS_LABELS[ticketItem.status]}
                        </Badge>
                        {ticketItem.assignedTo ? (
                          <Badge color='cyan' variant='light'>
                            {ticketItem.assignedTo}
                          </Badge>
                        ) : (
                          <Badge color='gray' variant='light'>
                            Unassigned
                          </Badge>
                        )}
                      </Group>
                    </Stack>
                  </Group>

                  <Group gap='xs'>
                    {STATUS_ORDER.map((status) => (
                      <Button
                        key={status}
                        size='xs'
                        variant={
                          ticketItem.status === status ? 'filled' : 'light'
                        }
                        onClick={() => handleStatusUpdate(ticketItem, status)}
                        disabled={updatingTicketId === ticketItem.id}
                      >
                        {STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              </Card>
            ))
          )}
        </Stack>
      </Stack>
    </>
  );
}
