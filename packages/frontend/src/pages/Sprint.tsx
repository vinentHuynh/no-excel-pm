import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Modal,
  Badge,
  Flex,
  Textarea,
  NumberInput,
  Select,
  Paper,
  ScrollArea,
  Grid,
  Divider,
  Loader,
  Center,
  ActionIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconChevronRight, IconQuestionMark } from '@tabler/icons-react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { apiClient } from '../api/client';
import { useDisclosure } from '@mantine/hooks';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  Task as ApiTask,
  Activity as ApiActivity,
  TaskStatus,
  ActivityType,
  UpdateTaskRequest,
} from '../../../shared/types';

// Local types that use Date objects for frontend convenience
interface Activity extends Omit<ApiActivity, 'timestamp'> {
  timestamp: Date;
}

interface Task
  extends Omit<
    ApiTask,
    'activities' | 'createdAt' | 'updatedAt' | 'domain' | 'createdBy'
  > {
  activities: Activity[];
}

export type SprintDemoTask = ApiTask;

type SprintPageProps = {
  demoMode?: boolean;
  demoTasks?: SprintDemoTask[];
};

const EMPTY_DEMO_TASKS: SprintDemoTask[] = [];

// Helper to convert API task to frontend task
function convertApiTask(apiTask: ApiTask): Task {
  return {
    ...apiTask,
    activities: apiTask.activities.map((activity) => ({
      ...activity,
      timestamp: new Date(activity.timestamp),
    })),
  };
}

// Helper function to get consistent color for each user, theme-aware
const getUserColor = (username: string): string => {
  const colors: Record<string, string> = {
    John: 'var(--user-color-john, #228be6)', // blue
    Sarah: 'var(--user-color-sarah, #f783ac)', // pink
    Mike: 'var(--user-color-mike, #40c057)', // green
    Emily: 'var(--user-color-emily, #845ef7)', // violet
    System: 'var(--user-color-system, #868e96)', // gray
  };
  return colors[username] || 'var(--user-color-default, #22b8cf)'; // cyan
};

interface SortableTaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

function SortableTaskCard({ task, onClick }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on input fields
    if ((e.target as HTMLElement).tagName === 'INPUT') {
      return;
    }
    onClick(task);
  };

  // Determine card color based on days left, using CSS variables for theme support
  let cardColor = undefined;

  // Check if task is completed first
  if (task.status === 'completed') {
    cardColor = 'var(--sprint-card-completed, #b2f2bb)';
  } else if (task.dueDate) {
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.floor(
      (dueDate.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / msPerDay
    );
    if (!task.startDate) {
      cardColor = '';
    } else if (daysLeft < 0) {
      cardColor = 'var(--sprint-card-overdue, #f8b4b4)';
    } else if (daysLeft <= 1) {
      cardColor = 'var(--sprint-card-due-soon, #a5d8ff)';
    } else if (daysLeft <= 7) {
      cardColor = 'var(--sprint-card-due-week, #ffd8a8)';
    } else if (daysLeft <= 28) {
      cardColor = 'var(--sprint-card-due-month, #fff3bf)';
    }
  }

  return (
    <Card
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: cardColor,
        color: cardColor ? '#000000' : undefined,
      }}
      shadow='sm'
      padding='sm'
      radius='md'
      withBorder
      mb='xs'
    >
      {/* Drag handle area */}
      <Box {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <Group justify='space-between' mb='xs' wrap='nowrap'>
          <Group gap='xs' wrap='nowrap' style={{ flex: 1 }}>
            {/* Drag icon */}
            <Text
              size='lg'
              style={{
                cursor: 'grab',
                userSelect: 'none',
                lineHeight: 1,
                color: cardColor ? '#000000' : 'var(--color-text)',
              }}
            >
              ⋮⋮
            </Text>
            <Text
              fw={550}
              size='md'
              style={{
                flex: 1,
                color: cardColor ? '#000000' : 'var(--color-text)',
              }}
            >
              {task.title}
            </Text>
          </Group>
          <Group gap='xs' wrap='nowrap'>
            {task.assignedTo && (
              <Badge
                size='sm'
                variant='light'
                style={{
                  backgroundColor: getUserColor(task.assignedTo),
                  color: cardColor ? '#000000' : 'var(--color-text)',
                }}
              >
                {task.assignedTo}
              </Badge>
            )}
            <ActionIcon
              variant='subtle'
              style={{
                color: cardColor ? '#000000' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
              size='sm'
              onClick={handleCardClick}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Clickable area */}
      <Box onClick={handleCardClick} style={{ cursor: 'pointer' }}>
        {task.startDate && (
          <Text size='xs' c={cardColor ? 'dark' : 'dimmed'}>
            🚀 Started: {new Date(task.startDate).toLocaleDateString()}
          </Text>
        )}
        {task.dueDate && (
          <Text size='xs' c={cardColor ? 'dark' : 'dimmed'}>
            📅 Due: {new Date(task.dueDate).toLocaleDateString()}
          </Text>
        )}
      </Box>
    </Card>
  );
}

interface ColumnProps {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  color: string;
}

function Column({ title, status, tasks, onTaskClick, color }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <Box style={{ flex: 1, minWidth: 300 }}>
      <Card
        shadow='sm'
        padding='md'
        radius='md'
        withBorder
        style={{
          backgroundColor: isOver ? 'var(--color-bg-secondary)' : undefined,
          transition: 'background-color 0.2s',
        }}
      >
        <Group justify='space-between' mb='md'>
          <Title order={4}>{title}</Title>
          <Badge color={color} variant='light'>
            {tasks.length}
          </Badge>
        </Group>

        <div ref={setNodeRef} style={{ minHeight: 400, width: '100%' }}>
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap='xs' style={{ minHeight: 400 }}>
              {tasks.length === 0 ? (
                <Box
                  style={{
                    minHeight: 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed var(--color-border)',
                    borderRadius: '8px',
                  }}
                >
                  <Text c='dimmed' size='sm' ta='center'>
                    Drop tasks here
                  </Text>
                </Box>
              ) : (
                tasks.map((task) => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                  />
                ))
              )}
            </Stack>
          </SortableContext>
        </div>
      </Card>
    </Box>
  );
}

export default function SprintPage({
  demoMode = false,
  demoTasks,
}: SprintPageProps) {
  const demoTaskSource = demoTasks ?? EMPTY_DEMO_TASKS;
  const { user } = useAuthenticator((context) => [context.user]);
  const currentUserName =
    user?.signInDetails?.loginId?.split('@')[0] ||
    user?.username ||
    (demoMode ? 'Demo User' : 'User');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<Array<{ value: string; label: string }>>(
    []
  );
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState<string | null>(null);

  // Load users from API
  const loadUsers = useCallback(async () => {
    if (demoMode) {
      setUsers([
        { value: '', label: 'Unassigned' },
        { value: 'John', label: 'John' },
        { value: 'Sarah', label: 'Sarah' },
        { value: 'Mike', label: 'Mike' },
        { value: 'Emily', label: 'Emily' },
      ]);
      return;
    }

    try {
      const response = await apiClient.getUsers();
      const userOptions = [
        { value: '', label: 'Unassigned' },
        ...response.users.map((user) => ({
          value: user.name,
          label: `${user.name} (${user.email})`,
        })),
      ];
      setUsers(userOptions);
    } catch (err) {
      console.error('Error loading users:', err);
      // Fallback to empty list if users can't be loaded
      setUsers([{ value: '', label: 'Unassigned' }]);
    }
  }, [demoMode]);

  // Load tasks from API or demo data on mount/when mode changes
  const loadTasks = useCallback(async () => {
    if (demoMode) {
      const initialTasks = demoTaskSource.map((task) => convertApiTask(task));
      setTasks(initialTasks);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getTasks();
      const convertedTasks = response.tasks.map(convertApiTask);
      setTasks(convertedTasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [demoMode, demoTaskSource]);

  useEffect(() => {
    loadUsers();
    loadTasks();
  }, [loadUsers, loadTasks]);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('backlog');
  const [newTaskHoursSpent, setNewTaskHoursSpent] = useState<number>(0);
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
  const [addingTask, setAddingTask] = useState(false);

  // Task details modal state
  const [detailsOpened, { open: openDetails, close: closeDetails }] =
    useDisclosure(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Color key modal state
  const [colorKeyOpened, { open: openColorKey, close: closeColorKey }] =
    useDisclosure(false);
  const [newComment, setNewComment] = useState('');
  // const [selectedLinkTask, setSelectedLinkTask] = useState<string>(''); // Kept for future linked tasks feature

  // Helper function to add activity
  const addActivity = (
    task: Task,
    type: ActivityType,
    text: string,
    metadata?: Activity['metadata']
  ): Task => {
    const activity: Activity = {
      id: `${task.id}-${Date.now()}`,
      type,
      text,
      author: currentUserName,
      timestamp: new Date(),
      metadata,
    };

    return {
      ...task,
      activities: [...task.activities, activity],
    };
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      console.log('No drop target');
      return;
    }

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    console.log('Drag ended:', { activeTaskId, overId });

    // Find the active task
    const activeTask = tasks.find((t) => t.id === activeTaskId);
    if (!activeTask) {
      console.log('Active task not found');
      return;
    }

    console.log('Active task:', activeTask);

    // Determine new status
    let newStatus: TaskStatus = activeTask.status;

    // Check if dropped over a column (status)
    if (
      overId === 'backlog' ||
      overId === 'in-progress' ||
      overId === 'completed'
    ) {
      newStatus = overId as TaskStatus;
      console.log('Dropped on column:', overId);
    } else {
      // Dropped over a task, get that task's status
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        newStatus = overTask.status;
        console.log(
          'Dropped on task:',
          overTask.title,
          'with status:',
          newStatus
        );
      }
    }

    console.log('New status will be:', newStatus);

    // If status changed, update it and log activity
    if (activeTask.status !== newStatus) {
      console.log('Status changed from', activeTask.status, 'to', newStatus);

      // Update task with new status
      const updatedTask = { ...activeTask, status: newStatus };

      // Optimistically update UI immediately for fluid experience
      setTasks((tasks) =>
        tasks.map((task) => (task.id === activeTaskId ? updatedTask : task))
      );

      // Save to DynamoDB in the background if not in demo mode
      if (!demoMode) {
        // Async update without blocking UI
        (async () => {
          try {
            const updateRequest: UpdateTaskRequest = {
              title: updatedTask.title,
              description: updatedTask.description,
              status: updatedTask.status,
              assignedTo: updatedTask.assignedTo,
              hoursSpent: updatedTask.hoursSpent,
              hoursExpected: updatedTask.hoursExpected,
            };

            const response = await apiClient.updateTask(
              updatedTask.id,
              updateRequest
            );
            const apiTask = response.task;
            const updatedTaskFromApi = convertApiTask(apiTask);

            // Update with server response (includes activity logs)
            setTasks((tasks) =>
              tasks.map((task) =>
                task.id === updatedTaskFromApi.id ? updatedTaskFromApi : task
              )
            );

            // Update selected task if it's the one being dragged
            if (selectedTask?.id === updatedTaskFromApi.id) {
              setSelectedTask(updatedTaskFromApi);
              setEditedTask(updatedTaskFromApi);
              setHasUnsavedChanges(false);
            }
          } catch (error) {
            console.error('Failed to update task status:', error);
            // Revert to original status on error
            setTasks((tasks) =>
              tasks.map((task) =>
                task.id === activeTaskId ? activeTask : task
              )
            );
            alert('Failed to update task status. Please try again.');
          }
        })();
      } else {
        // Demo mode: add activity to local state
        setTasks((tasks) => {
          const updatedTasks = tasks.map((task) => {
            if (task.id === activeTaskId) {
              // Set startDate when moving to in-progress for the first time
              const updatedTaskData = { ...task, status: newStatus };
              if (newStatus === 'in-progress' && !task.startDate) {
                updatedTaskData.startDate = new Date().toISOString();
              }

              const taskWithActivity = addActivity(
                updatedTaskData,
                'status_change',
                `Status changed from ${activeTask.status} to ${newStatus}`,
                {
                  oldValue: activeTask.status,
                  newValue: newStatus,
                  fieldName: 'status',
                }
              );
              return taskWithActivity;
            }
            return task;
          });
          return updatedTasks;
        });
      }
    } else {
      // Same column, just reordering
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask && activeTaskId !== overId) {
        console.log('Reordering within same column');
        setTasks((tasks) => {
          const oldIndex = tasks.findIndex((t) => t.id === activeTaskId);
          const newIndex = tasks.findIndex((t) => t.id === overId);

          const newTasks = [...tasks];
          const [movedTask] = newTasks.splice(oldIndex, 1);
          newTasks.splice(newIndex, 0, movedTask);

          return newTasks;
        });
      }
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    if (demoMode) {
      const now = Date.now();
      const newTask: Task = {
        id: `demo-task-${now}`,
        title: newTaskTitle,
        description: newTaskDescription,
        status: newTaskStatus,
        hoursExpected: 0,
        hoursSpent: newTaskHoursSpent,
        assignedTo: newTaskAssignedTo,
        dueDate: newTaskDueDate || undefined,
        linkedTasks: [],
        activities: [
          {
            id: `demo-activity-${now}`,
            type: 'created',
            text: 'Task created in demo mode',
            author: currentUserName,
            timestamp: new Date(),
          },
        ],
      };

      setTasks([...tasks, newTask]);

      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskStatus('backlog');
      setNewTaskHoursSpent(0);
      setNewTaskAssignedTo('');
      setNewTaskDueDate('');
      close();
      return;
    }

    setAddingTask(true);
    try {
      const response = await apiClient.createTask({
        title: newTaskTitle,
        description: newTaskDescription,
        status: newTaskStatus,
        hoursExpected: 0,
        assignedTo: newTaskAssignedTo,
        dueDate: newTaskDueDate || undefined,
      });

      const newTask = convertApiTask(response.task);
      setTasks([...tasks, newTask]);

      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskStatus('backlog');
      setNewTaskHoursSpent(0);
      setNewTaskAssignedTo('');
      setNewTaskDueDate('');
      close();
    } catch (err) {
      console.error('Error creating task:', err);
      alert('Failed to create task. Please try again.');
    } finally {
      setAddingTask(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setEditedTask(task);
    setHasUnsavedChanges(false);
    openDetails();
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    // Find the original task to compare changes
    const originalTask = tasks.find((t) => t.id === updatedTask.id);
    if (!originalTask) return;

    if (demoMode) {
      // Set startDate when moving to in-progress for the first time in demo mode
      if (
        updatedTask.status === 'in-progress' &&
        !originalTask.startDate &&
        !updatedTask.startDate
      ) {
        updatedTask.startDate = new Date().toISOString();
      }

      setTasks((tasks) =>
        tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
      );
      setSelectedTask(updatedTask);
      setEditedTask(updatedTask);
      setHasUnsavedChanges(false);
      return;
    }

    try {
      // Create update request with only the fields that can be updated
      const updateRequest: UpdateTaskRequest = {
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        assignedTo: updatedTask.assignedTo,
        hoursSpent: updatedTask.hoursSpent,
        hoursExpected: updatedTask.hoursExpected,
        dueDate: updatedTask.dueDate,
      };

      // Call API to update task
      const response = await apiClient.updateTask(
        updatedTask.id,
        updateRequest
      );
      const apiTask = response.task;
      const updatedTaskFromApi = convertApiTask(apiTask);

      // Update local state with the response from API
      setTasks((tasks) =>
        tasks.map((task) =>
          task.id === updatedTaskFromApi.id ? updatedTaskFromApi : task
        )
      );
      setSelectedTask(updatedTaskFromApi);
      setEditedTask(updatedTaskFromApi);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('Failed to update task. Please try again.');
    }
  };

  // Kept for future implementation of linked tasks feature
  // const handleLinkTask = () => {
  //   if (!selectedTask || !selectedLinkTask) return;

  //   // Don't link task to itself
  //   if (selectedTask.id === selectedLinkTask) return;

  //   // Don't link if already linked
  //   if (selectedTask.linkedTasks.includes(selectedLinkTask)) return;

  //   const updatedTask = {
  //     ...selectedTask,
  //     linkedTasks: [...selectedTask.linkedTasks, selectedLinkTask],
  //   };

  //   setTasks(tasks.map((t) => (t.id === selectedTask.id ? updatedTask : t)));
  //   setSelectedTask(updatedTask);
  //   setEditedTask(updatedTask);
  //   setSelectedLinkTask('');

  //   // Add activity
  //   const linkedTask = tasks.find((t) => t.id === selectedLinkTask);
  //   if (linkedTask) {
  //     const taskWithActivity = addActivity(
  //       updatedTask,
  //       'assignment',
  //       `Linked to task: ${linkedTask.title}`
  //     );
  //     setTasks(
  //       tasks.map((t) => (t.id === selectedTask.id ? taskWithActivity : t))
  //     );
  //     setSelectedTask(taskWithActivity);
  //     setEditedTask(taskWithActivity);
  //   }
  // };

  // const handleUnlinkTask = (taskIdToUnlink: string) => {
  //   if (!selectedTask) return;

  //   const updatedTask = {
  //     ...selectedTask,
  //     linkedTasks: selectedTask.linkedTasks.filter(
  //       (id) => id !== taskIdToUnlink
  //     ),
  //   };

  //   setTasks(tasks.map((t) => (t.id === selectedTask.id ? updatedTask : t)));
  //   setSelectedTask(updatedTask);
  //   setEditedTask(updatedTask);

  //   // Add activity
  //   const unlinkedTask = tasks.find((t) => t.id === taskIdToUnlink);
  //   if (unlinkedTask) {
  //     const taskWithActivity = addActivity(
  //       updatedTask,
  //       'assignment',
  //       `Unlinked from task: ${unlinkedTask.title}`
  //     );
  //     setTasks(
  //       tasks.map((t) => (t.id === selectedTask.id ? taskWithActivity : t))
  //     );
  //     setSelectedTask(taskWithActivity);
  //     setEditedTask(taskWithActivity);
  //   }
  // };

  const handleAddComment = async () => {
    if (!selectedTask || !newComment.trim()) return;

    if (demoMode) {
      const commentActivity: Activity = {
        id: `${selectedTask.id}-comment-${Date.now()}`,
        type: 'comment',
        text: newComment,
        author: currentUserName,
        timestamp: new Date(),
      };

      const updatedTask: Task = {
        ...selectedTask,
        activities: [...selectedTask.activities, commentActivity],
      };

      setTasks((tasks) =>
        tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
      );
      setSelectedTask(updatedTask);
      setEditedTask(updatedTask);
      setNewComment('');
      return;
    }

    try {
      const response = await apiClient.addComment(selectedTask.id, newComment);
      const updatedTask = convertApiTask(response.task);

      setTasks((tasks) =>
        tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
      );
      setSelectedTask(updatedTask);
      setEditedTask(updatedTask);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment. Please try again.');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (demoMode) {
      setTasks(tasks.filter((task) => task.id !== id));
      if (selectedTask?.id === id) {
        setSelectedTask(null);
        setEditedTask(null);
        setHasUnsavedChanges(false);
      }
      return;
    }

    // Store the task in case we need to restore it on error
    const taskToDelete = tasks.find((task) => task.id === id);
    if (!taskToDelete) return;

    // Optimistically remove from UI immediately for responsive feel
    setTasks(tasks.filter((task) => task.id !== id));
    if (selectedTask?.id === id) {
      setSelectedTask(null);
      setEditedTask(null);
      setHasUnsavedChanges(false);
      closeDetails();
    }

    // Delete from database in the background
    try {
      await apiClient.deleteTask(id);
      // Successfully deleted from database
    } catch (err) {
      console.error('Error deleting task:', err);
      // Restore the task on error
      setTasks((currentTasks) => [...currentTasks, taskToDelete]);
      alert('Failed to delete task. The task has been restored.');
    }
  };

  const openAddTaskModal = (status: TaskStatus) => {
    setNewTaskStatus(status);
    open();
  };

  const backlogTasks = tasks.filter((t) => t.status === 'backlog');
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Show loading state
  if (loading) {
    return (
      <Center h='100vh'>
        <Stack align='center'>
          <Loader size='lg' />
          <Text>Loading tasks...</Text>
        </Stack>
      </Center>
    );
  }

  // Show error state
  if (error) {
    return (
      <Center h='100vh'>
        <Stack align='center'>
          <Text c='red' size='lg'>
            Error: {error}
          </Text>
          <Button onClick={loadTasks}>Retry</Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Box p='md'>
      <Group justify='space-between' mb='xl'>
        <Title order={2}>Project Board</Title>
        <Group gap='xs'>
          <ActionIcon
            variant='default'
            size='lg'
            onClick={openColorKey}
            title='Color Key'
          >
            <IconQuestionMark size={20} />
          </ActionIcon>
          <Button onClick={() => openAddTaskModal('backlog')}>Add Task</Button>
        </Group>
      </Group>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Flex gap='md' wrap='wrap'>
          <Column
            title='Not Started'
            status='backlog'
            tasks={backlogTasks}
            onTaskClick={handleTaskClick}
            color='gray'
          />
          <Column
            title='In Progress'
            status='in-progress'
            tasks={inProgressTasks}
            onTaskClick={handleTaskClick}
            color='blue'
          />
          <Column
            title='Completed'
            status='completed'
            tasks={completedTasks}
            onTaskClick={handleTaskClick}
            color='green'
          />
        </Flex>

        <DragOverlay>
          {activeTask ? (
            <Card shadow='lg' padding='sm' radius='md' withBorder>
              <Text fw={500} size='sm'>
                {activeTask.title}
              </Text>
              {activeTask.description && (
                <Text size='xs' c='dimmed' mt='xs'>
                  {activeTask.description}
                </Text>
              )}
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal opened={opened} onClose={close} title='Add New Task'>
        <Stack gap='md'>
          <TextInput
            label='Task Title'
            placeholder='Enter task title'
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label='Description'
            placeholder='Enter task description'
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.currentTarget.value)}
            minRows={3}
          />

          <NumberInput
            label='Hours Spent'
            value={newTaskHoursSpent}
            onChange={(value) => setNewTaskHoursSpent(Number(value) || 0)}
            min={0}
            step={0.5}
          />

          <DatePickerInput
            label='Due Date'
            placeholder='Select due date'
            value={newTaskDueDate ? new Date(newTaskDueDate) : null}
            onChange={(value) => {
              if (!value) {
                setNewTaskDueDate('');
              } else if (typeof value === 'string') {
                setNewTaskDueDate(value);
              }
            }}
            clearable
            firstDayOfWeek={0}
            valueFormat='MM/DD/YYYY'
          />

          <Select
            label='Assigned To'
            placeholder='Select a team member'
            value={newTaskAssignedTo}
            onChange={(value) => setNewTaskAssignedTo(value || '')}
            data={users}
            searchable
          />

          <Select
            label='Status'
            value={newTaskStatus}
            onChange={(value) => setNewTaskStatus(value as TaskStatus)}
            data={[
              { value: 'backlog', label: 'Not Started' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
            ]}
          />

          <Group justify='flex-end' mt='md'>
            <Button variant='subtle' onClick={close} disabled={addingTask}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} loading={addingTask}>
              Add Task
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Task Details Modal */}
      <Modal
        opened={detailsOpened}
        onClose={() => {
          if (hasUnsavedChanges) {
            const confirmClose = window.confirm(
              'You have unsaved changes. Are you sure you want to close without saving?'
            );
            if (confirmClose) {
              setHasUnsavedChanges(false);
              closeDetails();
            }
          } else {
            closeDetails();
          }
        }}
        title='Task Details'
        size='80%'
      >
        {selectedTask && editedTask && (
          <Stack gap='md'>
            <Grid gutter='md'>
              {/* Row 1: Task Details and Activity Log */}
              {/* Left Column - Task Details Form */}
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Stack gap='s'>
                  {/* Task Title */}
                  <TextInput
                    label='Title'
                    value={editedTask.title}
                    onChange={(e) => {
                      setEditedTask({
                        ...editedTask,
                        title: e.currentTarget.value,
                      });
                      setHasUnsavedChanges(true);
                    }}
                  />

                  {/* Description */}
                  <Textarea
                    label='Description'
                    placeholder='Add task description'
                    value={editedTask.description}
                    onChange={(e) => {
                      setEditedTask({
                        ...editedTask,
                        description: e.currentTarget.value,
                      });
                      setHasUnsavedChanges(true);
                    }}
                    minRows={3}
                  />

                  {/* Hours Spent */}
                  <NumberInput
                    label='Hours Spent'
                    value={editedTask.hoursSpent}
                    onChange={(value) => {
                      setEditedTask({
                        ...editedTask,
                        hoursSpent: Number(value) || 0,
                      });
                      setHasUnsavedChanges(true);
                    }}
                    min={0}
                    step={0.5}
                  />

                  {/* Due Date */}
                  <DatePickerInput
                    label='Due Date'
                    placeholder='Select due date'
                    value={
                      editedTask.dueDate
                        ? new Date(editedTask.dueDate + 'T00:00:00')
                        : null
                    }
                    onChange={(value) => {
                      let isoDate: string | undefined = undefined;
                      if (value) {
                        if (typeof value === 'string') {
                          isoDate = value;
                        } else {
                          // value is a Date object - format as YYYY-MM-DD in local time
                          const date = value as Date;
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(
                            2,
                            '0'
                          );
                          const day = String(date.getDate()).padStart(2, '0');
                          isoDate = `${year}-${month}-${day}`;
                        }
                      }
                      setEditedTask({
                        ...editedTask,
                        dueDate: isoDate,
                      });
                      setHasUnsavedChanges(true);
                    }}
                    clearable
                    firstDayOfWeek={0}
                    valueFormat='MM/DD/YYYY'
                  />

                  {/* Assigned To */}
                  <Select
                    label='Assigned To'
                    placeholder='Select a team member'
                    value={editedTask.assignedTo}
                    onChange={(value) => {
                      setEditedTask({
                        ...editedTask,
                        assignedTo: value || '',
                      });
                      setHasUnsavedChanges(true);
                    }}
                    data={users}
                    searchable
                  />

                  {/* Status */}
                  <Select
                    label='Status'
                    value={editedTask.status}
                    onChange={(value) => {
                      setEditedTask({
                        ...editedTask,
                        status: value as TaskStatus,
                      });
                      setHasUnsavedChanges(true);
                    }}
                    data={[
                      { value: 'backlog', label: 'Not Started' },
                      { value: 'in-progress', label: 'In Progress' },
                      { value: 'completed', label: 'Completed' },
                    ]}
                  />
                </Stack>
              </Grid.Col>

              {/* Right Column - Activity Log */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap='xs'>
                  <Text size='sm' fw={500}>
                    Activity
                  </Text>

                  <ScrollArea>
                    <Stack gap='xs'>
                      {selectedTask.activities.length === 0 ? (
                        <Text c='dimmed' size='sm' ta='center'>
                          No activity yet
                        </Text>
                      ) : (
                        selectedTask.activities
                          .slice()
                          .reverse()
                          .map((activity) => {
                            // Determine icon based on activity type
                            const getActivityIcon = (type: ActivityType) => {
                              switch (type) {
                                case 'created':
                                  return '✨';
                                case 'comment':
                                  return '💬';
                                case 'status_change':
                                  return '🔄';
                                case 'assignment':
                                  return '👤';
                                case 'hours_update':
                                  return '⏱️';
                                default:
                                  return '📝';
                              }
                            };

                            // For comments, show "Added Comment" message
                            const activityText =
                              activity.type === 'comment'
                                ? 'Added Comment'
                                : activity.text;

                            return (
                              <Paper key={activity.id} p={6} withBorder>
                                <Group gap={4} wrap='nowrap' mb={2}>
                                  <Text size='sm'>
                                    {getActivityIcon(activity.type)}
                                  </Text>
                                  <Box style={{ flex: 1, minWidth: 0 }}>
                                    <Text
                                      size='xs'
                                      fw={500}
                                      truncate
                                      c={getUserColor(activity.author)}
                                    >
                                      {activity.author}
                                    </Text>
                                    <Text size='10px' c='dimmed' lh={1.2}>
                                      {new Date(
                                        activity.timestamp
                                      ).toLocaleString('en-US', {
                                        month: 'numeric',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}
                                    </Text>
                                  </Box>
                                </Group>
                                <Text size='10px' pl={20} c='dimmed'>
                                  {activityText}
                                </Text>
                              </Paper>
                            );
                          })
                      )}
                    </Stack>
                  </ScrollArea>
                </Stack>
              </Grid.Col>

              {/* Row 2: Comments Section - Left Side */}
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Divider mb='md' />
                <Stack gap='xs'>
                  <Text fw={500}>Comments</Text>

                  {/* Comments List */}
                  <ScrollArea h={200}>
                    <Stack gap='xs'>
                      {selectedTask.activities.filter(
                        (a) => a.type === 'comment'
                      ).length === 0 ? (
                        <Text c='dimmed' size='sm' ta='center'>
                          No comments yet
                        </Text>
                      ) : (
                        selectedTask.activities
                          .filter((activity) => activity.type === 'comment')
                          .slice()
                          .reverse()
                          .map((comment) => (
                            <Paper key={comment.id} p='xs' withBorder>
                              <Group
                                justify='space-between'
                                mb={4}
                                wrap='nowrap'
                              >
                                <Text
                                  size='sm'
                                  fw={500}
                                  truncate
                                  c={getUserColor(comment.author)}
                                >
                                  💬 {comment.author}
                                </Text>
                                <Text
                                  size='xs'
                                  c='dimmed'
                                  style={{ whiteSpace: 'nowrap' }}
                                >
                                  {new Date(comment.timestamp).toLocaleString(
                                    'en-US',
                                    {
                                      month: 'numeric',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    }
                                  )}
                                </Text>
                              </Group>
                              <Text size='sm' pl={20}>
                                {comment.text}
                              </Text>
                            </Paper>
                          ))
                      )}
                    </Stack>
                  </ScrollArea>

                  {/* Add Comment */}
                  <Group gap='xs'>
                    <TextInput
                      placeholder='Add a comment...'
                      value={newComment}
                      onChange={(e) => setNewComment(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button onClick={handleAddComment}>Comment</Button>
                  </Group>

                  {/* Action Buttons */}
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Box
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minHeight: '300px',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Group gap='xs' justify='flex-end'>
                    <Button
                      variant='filled'
                      color='red'
                      size='sm'
                      style={{ width: '155px' }}
                      onClick={() => {
                        if (selectedTask) {
                          handleDeleteTask(selectedTask.id);
                          closeDetails();
                        }
                      }}
                    >
                      Delete Task
                    </Button>
                    <Button
                      variant='filled'
                      color='blue'
                      size='sm'
                      style={{ width: '155px' }}
                      onClick={() => {
                        if (editedTask) {
                          handleUpdateTask(editedTask);
                          setHasUnsavedChanges(false);
                          closeDetails();
                        }
                      }}
                      disabled={!hasUnsavedChanges}
                    >
                      Save Changes
                    </Button>
                  </Group>
                </Box>
              </Grid.Col>
            </Grid>
          </Stack>
        )}
      </Modal>

      {/* Color Key Modal */}
      <Modal
        opened={colorKeyOpened}
        onClose={closeColorKey}
        title='Task Card Color Key'
        size='md'
      >
        <Stack gap='md'>
          <Text size='sm' c='dimmed'>
            Task cards are colored based on their status and due date:
          </Text>

          <Paper
            p='md'
            style={{ backgroundColor: 'var(--sprint-card-completed, #b2f2bb)' }}
          >
            <Text fw={500} c='dark'>
              Completed
            </Text>
            <Text size='sm' c='dark'>
              Task is marked as completed
            </Text>
          </Paper>

          <Paper
            p='md'
            style={{
              backgroundColor: 'var(--sprint-card-notstarted, #dee2e6)',
            }}
          >
            <Text fw={500} c='dark'>
              Not Started
            </Text>
            <Text size='sm' c='dark'>
              Task has no due date set
            </Text>
          </Paper>

          <Paper
            p='md'
            style={{ backgroundColor: 'var(--sprint-card-overdue, #f8b4b4)' }}
          >
            <Text fw={500} c='dark'>
              Overdue
            </Text>
            <Text size='sm' c='dark'>
              Due date has passed
            </Text>
          </Paper>

          <Paper
            p='md'
            style={{ backgroundColor: 'var(--sprint-card-due-soon, #a5d8ff)' }}
          >
            <Text fw={500} c='dark'>
              Due Today or Tomorrow
            </Text>
            <Text size='sm' c='dark'>
              Due within 2 days
            </Text>
          </Paper>

          <Paper
            p='md'
            style={{ backgroundColor: 'var(--sprint-card-due-week, #ffd8a8)' }}
          >
            <Text fw={500} c='dark'>
              Due This Week
            </Text>
            <Text size='sm' c='dark'>
              Due within 7 days
            </Text>
          </Paper>

          <Paper
            p='md'
            style={{ backgroundColor: 'var(--sprint-card-due-month, #fff3bf)' }}
          >
            <Text fw={500} c='dark'>
              Due This Month
            </Text>
            <Text size='sm' c='dark'>
              Due within 30 days
            </Text>
          </Paper>

          <Paper p='md' withBorder>
            <Text fw={500}>No Color</Text>
            <Text size='sm' c='dimmed'>
              Due date is more than 30 days away
            </Text>
          </Paper>
        </Stack>
      </Modal>
    </Box>
  );
}
