import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  List,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type DemoStatus = 'backlog' | 'in-progress' | 'completed';

type DemoTask = {
  id: string;
  title: string;
  description: string;
  status: DemoStatus;
  owner: string;
  impact: string;
};

const INITIAL_TASKS: DemoTask[] = [
  {
    id: 'task-ux-iter',
    title: 'Triage UX feedback from last retro',
    description:
      'Cluster recurring UX complaints and convert top 3 into actionable stories.',
    status: 'backlog',
    owner: 'Ava',
    impact: '20% drop in support tickets',
  },
  {
    id: 'task-ai-handsoff',
    title: 'Automate weekly status digest',
    description:
      'Use our AI summary to email stakeholders a Friday snapshot of risks.',
    status: 'in-progress',
    owner: 'Noah',
    impact: 'Saves PMs 2 hours every Friday',
  },
  {
    id: 'task-capacity',
    title: 'Forecast sprint capacity with historical data',
    description:
      'Blend Jira velocity with actual hours to predict safe commitment levels.',
    status: 'in-progress',
    owner: 'Maya',
    impact: 'Confidence score reaches 85%',
  },
  {
    id: 'task-adoption',
    title: 'Launch rollout checklist for onboarding teams',
    description: 'Create a template with gates, owners, and status automation.',
    status: 'completed',
    owner: 'Luis',
    impact: 'Playbook adopted by 4 pilot teams',
  },
  {
    id: 'task-metric',
    title: 'Introduce burndown sparkline to dashboards',
    description: 'Give execs a single-glance view of sprint trend health.',
    status: 'backlog',
    owner: 'Jules',
    impact: 'Exec check-ins shorten by 15%',
  },
];

const COLUMNS: Array<{
  status: DemoStatus;
  title: string;
  subtitle: string;
  color: string;
}> = [
  {
    status: 'backlog',
    title: 'Backlog',
    subtitle: 'Ideas ready for prioritization',
    color: 'gray',
  },
  {
    status: 'in-progress',
    title: 'In progress',
    subtitle: 'Teams actively executing',
    color: 'indigo',
  },
  {
    status: 'completed',
    title: 'Completed',
    subtitle: 'Win stories to celebrate',
    color: 'teal',
  },
];

function cloneInitialTasks(): DemoTask[] {
  return INITIAL_TASKS.map((task) => ({ ...task }));
}

function TaskCard({ task }: { task: DemoTask }) {
  const theme = useMantineTheme();

  return (
    <Card withBorder shadow='sm' padding='md' radius='md'>
      <Stack gap='xs'>
        <Group justify='space-between' align='flex-start'>
          <Stack gap={2} style={{ flex: 1 }}>
            <Text fw={600}>{task.title}</Text>
            <Text size='sm' c='dimmed'>
              {task.description}
            </Text>
          </Stack>
          <Badge variant='light' color={theme.primaryColor} size='sm'>
            {task.owner}
          </Badge>
        </Group>

        <Text size='xs' c='teal.6' fw={500}>
          Impact: {task.impact}
        </Text>
      </Stack>
    </Card>
  );
}

function SortableTaskCard({ task }: { task: DemoTask }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} />
    </div>
  );
}

function Column({
  status,
  tasks,
  title,
  subtitle,
  color,
}: {
  status: DemoStatus;
  tasks: DemoTask[];
  title: string;
  subtitle: string;
  color: string;
}) {
  const theme = useMantineTheme();
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <Stack
      gap='md'
      style={{
        minWidth: 280,
        flex: 1,
      }}
    >
      <Stack gap={2}>
        <Group justify='space-between'>
          <Title order={4}>{title}</Title>
          <Badge color={color} variant='light'>
            {tasks.length}
          </Badge>
        </Group>
        <Text size='xs' c='dimmed'>
          {subtitle}
        </Text>
      </Stack>

      <Box
        ref={setNodeRef}
        style={{
          borderRadius: 12,
          border: isOver
            ? `1px solid ${theme.colors.indigo[4]}`
            : `1px dashed ${theme.colors.gray[4]}`,
          backgroundColor: isOver ? theme.colors.indigo[0] : 'transparent',
          padding: '12px',
          minHeight: 360,
        }}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <Stack gap='sm'>
            {tasks.length === 0 ? (
              <Text size='sm' c='dimmed' ta='center'>
                Drag cards here
              </Text>
            ) : (
              tasks.map((task) => (
                <SortableTaskCard key={task.id} task={task} />
              ))
            )}
          </Stack>
        </SortableContext>
      </Box>
    </Stack>
  );
}

export function DemoWorkspace() {
  const [tasks, setTasks] = useState<DemoTask[]>(() => cloneInitialTasks());
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  );

  const groupedTasks = useMemo(() => {
    return COLUMNS.reduce<Record<DemoStatus, DemoTask[]>>(
      (acc, column) => {
        acc[column.status] = tasks.filter(
          (task) => task.status === column.status
        );
        return acc;
      },
      {
        backlog: [],
        'in-progress': [],
        completed: [],
      }
    );
  }, [tasks]);

  const activeTask = activeTaskId
    ? tasks.find((task) => task.id === activeTaskId) ?? null
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);

    if (!over) {
      return;
    }

    const destination = over.id as DemoStatus;

    setTasks((current) => {
      const taskIndex = current.findIndex((task) => task.id === active.id);
      if (taskIndex === -1) {
        return current;
      }

      if (current[taskIndex].status === destination) {
        return current;
      }

      const next = [...current];
      next[taskIndex] = {
        ...next[taskIndex],
        status: destination,
      };
      return next;
    });
  };

  const resetBoard = () => {
    setTasks(cloneInitialTasks());
    setActiveTaskId(null);
  };

  return (
    <Stack gap='xl'>
      <Stack gap='xs'>
        <Title order={2}>Interactive sprint demo</Title>
        <Text c='dimmed'>
          Drag cards to see how Paroview keeps delivery, context, and impact
          in sync — all without spreadsheets.
        </Text>
      </Stack>

      <List size='sm' spacing='xs'>
        <List.Item>Use drag-and-drop to move work between stages.</List.Item>
        <List.Item>
          Each card tracks owners, context, and business impact.
        </List.Item>
        <List.Item>
          Hit reset anytime to replay the scenario with fresh data.
        </List.Item>
      </List>

      <Group justify='space-between'>
        <Group gap='sm'>
          <Badge color='lime' variant='filled'>
            Live demo
          </Badge>
          <Text size='sm' c='dimmed'>
            No account required — your changes stay local.
          </Text>
        </Group>
        <Button variant='light' onClick={resetBoard}>
          Reset demo workspace
        </Button>
      </Group>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Group
          align='stretch'
          wrap='nowrap'
          gap='md'
          style={{ overflowX: 'auto' }}
        >
          {COLUMNS.map((column) => (
            <Column
              key={column.status}
              status={column.status}
              tasks={groupedTasks[column.status]}
              title={column.title}
              subtitle={column.subtitle}
              color={column.color}
            />
          ))}
        </Group>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </Stack>
  );
}
