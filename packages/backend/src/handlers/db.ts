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
  Activity,
  buildTaskPK,
  buildMetaSK,
  buildDomainGSI1PK,
} from '@no-excel-pm/shared';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

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

export async function getTask(domain: string, taskId: string): Promise<Task | null> {
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

export async function createTask(
  domain: string,
  taskData: Partial<Task>,
  createdBy: string
): Promise<Task> {
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
  const updatedTask: Task = {
    ...existingTask,
    ...updates,
    id: taskId, // Ensure ID doesn't change
    domain, // Ensure domain doesn't change
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

export async function deleteTask(domain: string, taskId: string): Promise<void> {
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
