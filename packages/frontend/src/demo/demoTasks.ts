import type { Task as ApiTask, ActivityType } from '../../../shared/types';

const demoDomain = 'demo.paroview';

const buildActivity = (
  id: string,
  type: ActivityType,
  text: string,
  author: string,
  timestamp: string
) => ({
  id,
  type,
  text,
  author,
  timestamp,
});

const demoTasksTemplate: ApiTask[] = [
  {
    id: 'demo-sync-plan',
    title: 'Shape kickoff sync for platform rollout',
    description:
      'Align GTM, product, and ops on launch milestones and risk mitigations to keep our rollout on track.',
    status: 'backlog',
    activities: [
      buildActivity(
        'demo-sync-plan-activity-1',
        'created',
        'Task created for demo sprint',
        'Maya',
        '2025-06-02T14:20:00.000Z'
      ),
      buildActivity(
        'demo-sync-plan-activity-2',
        'comment',
        'Can we add a pre-read doc before the sync?',
        'Luis',
        '2025-06-03T09:15:00.000Z'
      ),
    ],
    hoursSpent: 1,
    hoursExpected: 6,
    assignedTo: 'Maya',
    linkedTasks: ['demo-health-dashboard'],
    domain: demoDomain,
    createdAt: '2025-06-02T14:20:00.000Z',
    updatedAt: '2025-06-03T09:15:00.000Z',
    createdBy: 'maya@demo.paroview',
  },
  {
    id: 'demo-health-dashboard',
    title: 'Ship executive delivery health dashboard',
    description:
      'Land a C-suite snapshot with status, blockers, and burndown trend for the top three initiatives.',
    status: 'in-progress',
    activities: [
      buildActivity(
        'demo-dashboard-activity-1',
        'created',
        'Task created for demo sprint',
        'Noah',
        '2025-05-28T12:00:00.000Z'
      ),
      buildActivity(
        'demo-dashboard-activity-2',
        'status_change',
        'Moved from backlog to in-progress',
        'Noah',
        '2025-06-01T10:30:00.000Z'
      ),
      buildActivity(
        'demo-dashboard-activity-3',
        'comment',
        'Need refreshed finance metrics before EOD.',
        'Ava',
        '2025-06-03T16:05:00.000Z'
      ),
    ],
    hoursSpent: 8,
    hoursExpected: 12,
    assignedTo: 'Noah',
    linkedTasks: ['demo-sync-plan', 'demo-risk-playbook'],
    domain: demoDomain,
    createdAt: '2025-05-28T12:00:00.000Z',
    updatedAt: '2025-06-03T16:05:00.000Z',
    createdBy: 'noah@demo.paroview',
  },
  {
    id: 'demo-risk-playbook',
    title: 'Draft risk response playbook for pilots',
    description:
      'Capture the top 5 rollout risks and recommended interventions so teams can swat issues quickly.',
    status: 'in-progress',
    activities: [
      buildActivity(
        'demo-risk-activity-1',
        'created',
        'Task created for demo sprint',
        'Emily',
        '2025-05-30T08:45:00.000Z'
      ),
      buildActivity(
        'demo-risk-activity-2',
        'comment',
        'Looped in legal for messaging review.',
        'Emily',
        '2025-06-04T11:25:00.000Z'
      ),
    ],
    hoursSpent: 5,
    hoursExpected: 10,
    assignedTo: 'Emily',
    linkedTasks: ['demo-health-dashboard'],
    domain: demoDomain,
    createdAt: '2025-05-30T08:45:00.000Z',
    updatedAt: '2025-06-04T11:25:00.000Z',
    createdBy: 'emily@demo.paroview',
  },
  {
    id: 'demo-retro-celebrate',
    title: 'Capture wins from pilot retrospectives',
    description:
      'Summarize the top learnings and automation wins from the last two sprints to share with leadership.',
    status: 'completed',
    activities: [
      buildActivity(
        'demo-retro-activity-1',
        'created',
        'Task created for demo sprint',
        'Luis',
        '2025-05-20T10:10:00.000Z'
      ),
      buildActivity(
        'demo-retro-activity-2',
        'status_change',
        'Marked complete after leadership sync',
        'Luis',
        '2025-05-31T15:40:00.000Z'
      ),
      buildActivity(
        'demo-retro-activity-3',
        'comment',
        'Publishing highlight reel to the exec channel.',
        'Luis',
        '2025-06-01T09:50:00.000Z'
      ),
    ],
    hoursSpent: 6,
    hoursExpected: 6,
    assignedTo: 'Luis',
    linkedTasks: ['demo-health-dashboard'],
    domain: demoDomain,
    createdAt: '2025-05-20T10:10:00.000Z',
    updatedAt: '2025-06-01T09:50:00.000Z',
    createdBy: 'luis@demo.paroview',
  },
];

export function getDemoTasks(): ApiTask[] {
  return demoTasksTemplate.map((task) => ({
    ...task,
    activities: task.activities.map((activity) => ({ ...activity })),
    linkedTasks: [...task.linkedTasks],
  }));
}
