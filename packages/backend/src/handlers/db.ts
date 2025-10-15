import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Task,
  Ticket,
  TicketType,
  Activity,
  UserProfile,
  buildTaskPK,
  buildTicketPK,
  buildUserPK,
  buildMetaSK,
  buildDomainGSI1PK,
} from '@paroview/shared';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
const TABLE_NAME = process.env.TABLE_NAME!;

function normalizeTicket(ticket: Ticket & { type?: TicketType }): Ticket {
  return {
    ...ticket,
    type: ticket.type ?? 'feature',
  };
}

export async function getTasks(domain: string): Promise<Task[]> {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': buildDomainGSI1PK(domain, 'TASK'),
    },
  };

  const result = await docClient.send(new QueryCommand(params));
  return (result.Items || []).map((item) => item.data as Task);
}

export async function getTickets(domain: string): Promise<Ticket[]> {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': buildDomainGSI1PK(domain, 'TICKET'),
    },
  };

  const result = await docClient.send(new QueryCommand(params));
  return (result.Items || []).map((item) =>
    normalizeTicket(item.data as Ticket & { type?: TicketType })
  );
}

export async function getTask(
  domain: string,
  taskId: string
): Promise<Task | null> {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: buildTaskPK(domain, taskId),
      SK: buildMetaSK(),
    },
  };

  const result = await docClient.send(new GetCommand(params));
  return result.Item ? (result.Item.data as Task) : null;
}

export async function getTicket(
  domain: string,
  ticketId: string
): Promise<Ticket | null> {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: buildTicketPK(domain, ticketId),
      SK: buildMetaSK(),
    },
  };

  const result = await docClient.send(new GetCommand(params));
  if (!result.Item) {
    return null;
  }

  return normalizeTicket(result.Item.data as Ticket & { type?: TicketType });
}

export async function createTask(
  domain: string,
  taskData: Partial<Task>,
  createdBy: string
): Promise<Task> {
  const taskId = `task-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const now = new Date().toISOString();

  const task: Task = {
    id: taskId,
    title: taskData.title || '',
    description: taskData.description || '',
    status: taskData.status || 'backlog',
    activities: [
      {
        id: `${taskId}-created`,
        type: 'created',
        text: 'Task created',
        author: createdBy,
        timestamp: now,
      },
    ],
    hoursSpent: taskData.hoursSpent || 0,
    hoursExpected: taskData.hoursExpected || 0,
    assignedTo: taskData.assignedTo || '',
    linkedTasks: taskData.linkedTasks || [],
    domain,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  const item = {
    PK: buildTaskPK(domain, taskId),
    SK: buildMetaSK(),
    GSI1PK: buildDomainGSI1PK(domain, 'TASK'),
    GSI1SK: now,
    entityType: 'TASK',
    domain,
    data: task,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return task;
}

export async function createTicket(
  domain: string,
  ticketData: Partial<Ticket>,
  createdBy: string
): Promise<Ticket> {
  const ticketId = `ticket-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const now = new Date().toISOString();

  const ticket: Ticket = {
    id: ticketId,
    title: ticketData.title || '',
    description: ticketData.description || '',
    status: ticketData.status || 'new',
    type: (ticketData.type as TicketType) || 'feature',
    assignedTo: ticketData.assignedTo,
    domain,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  const item = {
    PK: buildTicketPK(domain, ticketId),
    SK: buildMetaSK(),
    GSI1PK: buildDomainGSI1PK(domain, 'TICKET'),
    GSI1SK: now,
    entityType: 'TICKET',
    domain,
    data: ticket,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return ticket;
}

export async function updateTask(
  domain: string,
  taskId: string,
  updates: Partial<Task>,
  updatedBy: string
): Promise<Task> {
  const existingTask = await getTask(domain, taskId);
  if (!existingTask) {
    throw new Error('Task not found');
  }

  const now = new Date().toISOString();

  // Generate activities for changes
  const newActivities: Activity[] = [];

  // Track status changes
  if (updates.status && updates.status !== existingTask.status) {
    newActivities.push({
      id: `${taskId}-${Date.now()}-status`,
      type: 'status_change',
      text: `Status changed from ${existingTask.status} to ${updates.status}`,
      author: updatedBy,
      timestamp: now,
      metadata: {
        oldValue: existingTask.status,
        newValue: updates.status,
        fieldName: 'status',
      },
    });
  }

  // Track assignment changes
  if (
    updates.assignedTo !== undefined &&
    updates.assignedTo !== existingTask.assignedTo
  ) {
    const oldAssignee = existingTask.assignedTo || 'Unassigned';
    const newAssignee = updates.assignedTo || 'Unassigned';
    newActivities.push({
      id: `${taskId}-${Date.now()}-assignment`,
      type: 'assignment',
      text: `Assigned to ${newAssignee}`,
      author: updatedBy,
      timestamp: now,
      metadata: {
        oldValue: oldAssignee,
        newValue: newAssignee,
        fieldName: 'assignedTo',
      },
    });
  }

  // Track hours updates
  if (
    updates.hoursSpent !== undefined &&
    updates.hoursSpent !== existingTask.hoursSpent
  ) {
    newActivities.push({
      id: `${taskId}-${Date.now()}-hours-spent`,
      type: 'hours_update',
      text: `Hours spent updated from ${existingTask.hoursSpent} to ${updates.hoursSpent}`,
      author: updatedBy,
      timestamp: now,
      metadata: {
        oldValue: existingTask.hoursSpent.toString(),
        newValue: updates.hoursSpent.toString(),
        fieldName: 'hoursSpent',
      },
    });
  }

  if (
    updates.hoursExpected !== undefined &&
    updates.hoursExpected !== existingTask.hoursExpected
  ) {
    newActivities.push({
      id: `${taskId}-${Date.now()}-hours-expected`,
      type: 'hours_update',
      text: `Expected hours updated from ${existingTask.hoursExpected} to ${updates.hoursExpected}`,
      author: updatedBy,
      timestamp: now,
      metadata: {
        oldValue: existingTask.hoursExpected.toString(),
        newValue: updates.hoursExpected.toString(),
        fieldName: 'hoursExpected',
      },
    });
  }

  const updatedTask: Task = {
    ...existingTask,
    ...updates,
    id: taskId, // Ensure ID doesn't change
    domain, // Ensure domain doesn't change
    activities: [...existingTask.activities, ...newActivities],
    updatedAt: now,
  };

  const item = {
    PK: buildTaskPK(domain, taskId),
    SK: buildMetaSK(),
    GSI1PK: buildDomainGSI1PK(domain, 'TASK'),
    GSI1SK: existingTask.createdAt,
    entityType: 'TASK',
    domain,
    data: updatedTask,
    createdAt: existingTask.createdAt,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return updatedTask;
}

export async function updateTicket(
  domain: string,
  ticketId: string,
  updates: Partial<Ticket>,
  updatedBy: string
): Promise<Ticket> {
  const existingTicket = await getTicket(domain, ticketId);
  if (!existingTicket) {
    throw new Error('Ticket not found');
  }

  const now = new Date().toISOString();

  const updatedTicket: Ticket = {
    ...existingTicket,
    ...updates,
    id: ticketId,
    domain,
    type:
      (updates.type as TicketType | undefined) ??
      existingTicket.type ??
      'feature',
    updatedAt: now,
  };

  const item = {
    PK: buildTicketPK(domain, ticketId),
    SK: buildMetaSK(),
    GSI1PK: buildDomainGSI1PK(domain, 'TICKET'),
    GSI1SK: existingTicket.createdAt,
    entityType: 'TICKET',
    domain,
    data: updatedTicket,
    createdAt: existingTicket.createdAt,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return updatedTicket;
}

export async function deleteTask(
  domain: string,
  taskId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildTaskPK(domain, taskId),
        SK: buildMetaSK(),
      },
    })
  );
}

export async function deleteTicket(
  domain: string,
  ticketId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildTicketPK(domain, ticketId),
        SK: buildMetaSK(),
      },
    })
  );
}

export async function addActivity(
  domain: string,
  taskId: string,
  activity: Omit<Activity, 'id' | 'timestamp'>
): Promise<Task> {
  const task = await getTask(domain, taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  const newActivity: Activity = {
    ...activity,
    id: `${taskId}-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  const updatedTask: Task = {
    ...task,
    activities: [...task.activities, newActivity],
    updatedAt: new Date().toISOString(),
  };

  const item = {
    PK: buildTaskPK(domain, taskId),
    SK: buildMetaSK(),
    GSI1PK: buildDomainGSI1PK(domain, 'TASK'),
    GSI1SK: task.createdAt,
    entityType: 'TASK',
    domain,
    data: updatedTask,
    createdAt: task.createdAt,
    updatedAt: updatedTask.updatedAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return updatedTask;
}

// User operations
export async function getUsers(domain: string): Promise<UserProfile[]> {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': buildDomainGSI1PK(domain, 'USER'),
    },
  };

  const result = await docClient.send(new QueryCommand(params));
  return (result.Items || []).map((item) => item.data as UserProfile);
}

export async function getUser(
  domain: string,
  userId: string
): Promise<UserProfile | null> {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(domain, userId),
      SK: buildMetaSK(),
    },
  };

  const result = await docClient.send(new GetCommand(params));
  return result.Item ? (result.Item.data as UserProfile) : null;
}

export async function getUserByEmail(
  domain: string,
  email: string
): Promise<UserProfile | null> {
  const users = await getUsers(domain);
  return (
    users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ||
    null
  );
}

export async function createUser(
  domain: string,
  userData: Omit<UserProfile, 'userId' | 'domain' | 'createdAt' | 'updatedAt'>
): Promise<UserProfile> {
  // Check if user already exists
  const existingUser = await getUserByEmail(domain, userData.email);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const userId = `user-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const now = new Date().toISOString();

  const user: UserProfile = {
    userId,
    email: userData.email.toLowerCase(),
    name: userData.name,
    domain,
    role: userData.role,
    createdAt: now,
    updatedAt: now,
  };

  const item = {
    PK: buildUserPK(domain, userId),
    SK: buildMetaSK(),
    GSI1PK: buildDomainGSI1PK(domain, 'USER'),
    GSI1SK: now,
    entityType: 'USER',
    domain,
    data: user,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return user;
}

export async function updateUser(
  domain: string,
  userId: string,
  updates: Partial<Pick<UserProfile, 'name' | 'role'>>
): Promise<UserProfile> {
  const existingUser = await getUser(domain, userId);
  if (!existingUser) {
    throw new Error('User not found');
  }

  const now = new Date().toISOString();
  const updatedUser: UserProfile = {
    ...existingUser,
    ...updates,
    userId,
    email: existingUser.email,
    domain,
    updatedAt: now,
  };

  const item = {
    PK: buildUserPK(domain, userId),
    SK: buildMetaSK(),
    GSI1PK: buildDomainGSI1PK(domain, 'USER'),
    GSI1SK: existingUser.createdAt,
    entityType: 'USER',
    domain,
    data: updatedUser,
    createdAt: existingUser.createdAt,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return updatedUser;
}

export async function deleteUser(
  domain: string,
  userId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildUserPK(domain, userId),
        SK: buildMetaSK(),
      },
    })
  );
}
