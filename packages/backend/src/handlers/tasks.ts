import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  addActivity,
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from './db';
import {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateTicketRequest,
  UpdateTicketRequest,
  TicketType,
  CreateUserRequest,
  UpdateUserRequest,
  extractDomain,
} from '@paroview/shared';

// Helper to extract user info from Cognito authorizer
function getUserFromEvent(event: APIGatewayProxyEvent): {
  userId: string;
  email: string;
  domain: string;
} {
  const claims = event.requestContext.authorizer?.claims;
  const email = claims?.email || 'unknown@example.com';
  const userId = claims?.sub || 'unknown-user';

  // Extract domain from email (e.g., user@companyA.com -> companyA)
  // You can customize this logic based on your domain strategy
  const domain =
    claims?.['custom:domain'] ||
    email.split('@')[1]?.split('.')[0] ||
    'default';

  return { userId, email, domain };
}

// Helper for CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

const VALID_TICKET_TYPES: TicketType[] = ['bug', 'feature'];

function isValidTicketType(
  value: string | TicketType | undefined
): value is TicketType {
  if (typeof value !== 'string') {
    return false;
  }

  return VALID_TICKET_TYPES.includes(value as TicketType);
}

// Helper to create response
function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

// GET /tasks - Get all tasks for user's domain
export async function getTasksHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const tasks = await getTasks(domain);

    return createResponse(200, { tasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    return createResponse(500, { error: 'Failed to get tasks' });
  }
}

// GET /tickets - Get all tickets for user's domain
export async function getTicketsHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const tickets = await getTickets(domain);

    return createResponse(200, { tickets });
  } catch (error) {
    console.error('Error getting tickets:', error);
    return createResponse(500, { error: 'Failed to get tickets' });
  }
}

// GET /tickets/{id} - Get a specific ticket
export async function getTicketHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const ticketId = event.pathParameters?.id;

    if (!ticketId) {
      return createResponse(400, { error: 'Ticket ID is required' });
    }

    const ticket = await getTicket(domain, ticketId);

    if (!ticket) {
      return createResponse(404, { error: 'Ticket not found' });
    }

    return createResponse(200, { ticket });
  } catch (error) {
    console.error('Error getting ticket:', error);
    return createResponse(500, { error: 'Failed to get ticket' });
  }
}

// POST /tickets - Create a new ticket
export async function createTicketHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain, email } = getUserFromEvent(event);
    const body: CreateTicketRequest = JSON.parse(event.body || '{}');

    if (!body.title) {
      return createResponse(400, { error: 'Title is required' });
    }

    const normalizedType =
      typeof body.type === 'string'
        ? (body.type.toLowerCase() as TicketType)
        : undefined;

    if (!isValidTicketType(normalizedType)) {
      return createResponse(400, {
        error: 'Ticket type must be either bug or feature',
      });
    }

    const payload = { ...body, type: normalizedType };
    console.log('Creating ticket with payload', {
      domain,
      user: email,
      payload,
    });

    const ticket = await createTicket(domain, payload, email);

    return createResponse(201, { ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    let message = 'Failed to create ticket';

    if (error instanceof Error) {
      message = `${error.name}: ${error.message}`;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      try {
        message = JSON.stringify(error);
      } catch {
        message = 'Failed to create ticket';
      }
    }

    return createResponse(500, { error: message });
  }
}

// PUT /tickets/{id} - Update a ticket
export async function updateTicketHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain, email } = getUserFromEvent(event);
    const ticketId = event.pathParameters?.id;
    const body: UpdateTicketRequest = JSON.parse(event.body || '{}');

    if (!ticketId) {
      return createResponse(400, { error: 'Ticket ID is required' });
    }

    const normalizedType =
      typeof body.type === 'string'
        ? (body.type.toLowerCase() as TicketType)
        : body.type;

    if (normalizedType !== undefined && !isValidTicketType(normalizedType)) {
      return createResponse(400, {
        error: 'Ticket type must be either bug or feature',
      });
    }

    const ticket = await updateTicket(
      domain,
      ticketId,
      {
        ...body,
        ...(normalizedType !== undefined ? { type: normalizedType } : {}),
      },
      email
    );

    return createResponse(200, { ticket });
  } catch (error) {
    console.error('Error updating ticket:', error);
    return createResponse(500, { error: 'Failed to update ticket' });
  }
}

// DELETE /tickets/{id} - Delete a ticket
export async function deleteTicketHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const ticketId = event.pathParameters?.id;

    if (!ticketId) {
      return createResponse(400, { error: 'Ticket ID is required' });
    }

    await deleteTicket(domain, ticketId);

    return createResponse(200, { success: true });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return createResponse(500, { error: 'Failed to delete ticket' });
  }
}

// GET /tasks/{id} - Get a specific task
export async function getTaskHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const taskId = event.pathParameters?.id;

    if (!taskId) {
      return createResponse(400, { error: 'Task ID is required' });
    }

    const task = await getTask(domain, taskId);

    if (!task) {
      return createResponse(404, { error: 'Task not found' });
    }

    return createResponse(200, { task });
  } catch (error) {
    console.error('Error getting task:', error);
    return createResponse(500, { error: 'Failed to get task' });
  }
}

// POST /tasks - Create a new task
export async function createTaskHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain, email } = getUserFromEvent(event);
    const body: CreateTaskRequest = JSON.parse(event.body || '{}');

    if (!body.title) {
      return createResponse(400, { error: 'Title is required' });
    }

    const task = await createTask(domain, body, email);

    return createResponse(201, { task });
  } catch (error) {
    console.error('Error creating task:', error);
    return createResponse(500, { error: 'Failed to create task' });
  }
}

// PUT /tasks/{id} - Update a task
export async function updateTaskHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain, email } = getUserFromEvent(event);
    const taskId = event.pathParameters?.id;
    const body: UpdateTaskRequest = JSON.parse(event.body || '{}');

    if (!taskId) {
      return createResponse(400, { error: 'Task ID is required' });
    }

    const task = await updateTask(domain, taskId, body, email);

    return createResponse(200, { task });
  } catch (error) {
    console.error('Error updating task:', error);
    return createResponse(500, { error: 'Failed to update task' });
  }
}

// DELETE /tasks/{id} - Delete a task
export async function deleteTaskHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const taskId = event.pathParameters?.id;

    if (!taskId) {
      return createResponse(400, { error: 'Task ID is required' });
    }

    await deleteTask(domain, taskId);

    return createResponse(200, { success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return createResponse(500, { error: 'Failed to delete task' });
  }
}

// POST /tasks/{id}/comments - Add a comment to a task
export async function addCommentHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain, email } = getUserFromEvent(event);
    const taskId = event.pathParameters?.id;
    const body = JSON.parse(event.body || '{}');

    if (!taskId) {
      return createResponse(400, { error: 'Task ID is required' });
    }

    if (!body.comment) {
      return createResponse(400, { error: 'Comment is required' });
    }

    const task = await addActivity(domain, taskId, {
      type: 'comment',
      text: body.comment,
      author: email,
    });

    return createResponse(200, { task });
  } catch (error) {
    console.error('Error adding comment:', error);
    return createResponse(500, { error: 'Failed to add comment' });
  }
}

// POST /tasks/{id}/link - Link a task to another task
export async function linkTaskHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain, email } = getUserFromEvent(event);
    const taskId = event.pathParameters?.id;
    const body = JSON.parse(event.body || '{}');

    if (!taskId) {
      return createResponse(400, { error: 'Task ID is required' });
    }

    if (!body.linkedTaskId) {
      return createResponse(400, { error: 'Linked task ID is required' });
    }

    const task = await getTask(domain, taskId);
    if (!task) {
      return createResponse(404, { error: 'Task not found' });
    }

    // Check if already linked
    if (task.linkedTasks.includes(body.linkedTaskId)) {
      return createResponse(400, { error: 'Task already linked' });
    }

    // Get linked task title for activity
    const linkedTask = await getTask(domain, body.linkedTaskId);
    const linkedTaskTitle = linkedTask?.title || 'Unknown task';

    // Add to linked tasks
    const updatedTask = await updateTask(
      domain,
      taskId,
      {
        linkedTasks: [...task.linkedTasks, body.linkedTaskId],
      },
      email
    );

    // Add activity
    await addActivity(domain, taskId, {
      type: 'assignment',
      text: `Linked to task: ${linkedTaskTitle}`,
      author: email,
    });

    // Fetch updated task with new activity
    const finalTask = await getTask(domain, taskId);

    return createResponse(200, { task: finalTask });
  } catch (error) {
    console.error('Error linking task:', error);
    return createResponse(500, { error: 'Failed to link task' });
  }
}

// DELETE /tasks/{id}/link/{linkedTaskId} - Unlink a task
export async function unlinkTaskHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { domain, email } = getUserFromEvent(event);
    const taskId = event.pathParameters?.id;
    const linkedTaskId = event.pathParameters?.linkedTaskId;

    if (!taskId || !linkedTaskId) {
      return createResponse(400, { error: 'Task IDs are required' });
    }

    const task = await getTask(domain, taskId);
    if (!task) {
      return createResponse(404, { error: 'Task not found' });
    }

    // Get linked task title for activity
    const linkedTask = await getTask(domain, linkedTaskId);
    const linkedTaskTitle = linkedTask?.title || 'Unknown task';

    // Remove from linked tasks
    const updatedTask = await updateTask(
      domain,
      taskId,
      {
        linkedTasks: task.linkedTasks.filter(
          (id: string) => id !== linkedTaskId
        ),
      },
      email
    );

    // Add activity
    await addActivity(domain, taskId, {
      type: 'assignment',
      text: `Unlinked from task: ${linkedTaskTitle}`,
      author: email,
    });

    // Fetch updated task with new activity
    const finalTask = await getTask(domain, taskId);

    return createResponse(200, { task: finalTask });
  } catch (error) {
    console.error('Error unlinking task:', error);
    return createResponse(500, { error: 'Failed to unlink task' });
  }
}

// User handlers
export async function getUsersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const users = await getUsers(domain);

    return createResponse(200, { users });
  } catch (error) {
    console.error('Error getting users:', error);
    return createResponse(500, { error: 'Failed to get users' });
  }
}

export async function getUserHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const userId = event.pathParameters?.id;

    if (!userId) {
      return createResponse(400, { error: 'User ID is required' });
    }

    const user = await getUser(domain, userId);

    if (!user) {
      return createResponse(404, { error: 'User not found' });
    }

    return createResponse(200, { user });
  } catch (error) {
    console.error('Error getting user:', error);
    return createResponse(500, { error: 'Failed to get user' });
  }
}

export async function createUserHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);

    if (!event.body) {
      return createResponse(400, { error: 'Request body is required' });
    }

    const body: CreateUserRequest = JSON.parse(event.body);

    if (!body.email || !body.name) {
      return createResponse(400, { error: 'Email and name are required' });
    }

    // Validate that the user's email domain matches the workspace domain
    const userEmailDomain = extractDomain(body.email);
    const workspaceDomain = extractDomain(domain + '@' + domain);

    if (
      userEmailDomain !== workspaceDomain &&
      !body.email.includes('@' + domain)
    ) {
      return createResponse(400, {
        error: `User email must be from the same domain as your workspace`,
      });
    }

    const user = await createUser(domain, {
      email: body.email,
      name: body.name,
      role: body.role || 'member',
    });

    return createResponse(201, { user });
  } catch (error) {
    console.error('Error creating user:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create user';
    return createResponse(500, { error: message });
  }
}

export async function updateUserHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const userId = event.pathParameters?.id;

    if (!userId) {
      return createResponse(400, { error: 'User ID is required' });
    }

    if (!event.body) {
      return createResponse(400, { error: 'Request body is required' });
    }

    const body: UpdateUserRequest = JSON.parse(event.body);

    const user = await updateUser(domain, userId, body);

    return createResponse(200, { user });
  } catch (error) {
    console.error('Error updating user:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to update user';
    return createResponse(500, { error: message });
  }
}

export async function deleteUserHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const { domain } = getUserFromEvent(event);
    const userId = event.pathParameters?.id;

    if (!userId) {
      return createResponse(400, { error: 'User ID is required' });
    }

    await deleteUser(domain, userId);

    return createResponse(200, { success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return createResponse(500, { error: 'Failed to delete user' });
  }
}
