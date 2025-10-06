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
  addActivity,
} from './db';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '@no-excel-pm/shared';

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
  const domain = claims?.['custom:domain'] || email.split('@')[1]?.split('.')[0] || 'default';

  return { userId, email, domain };
}

// Helper for CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

// Helper to create response
function createResponse(
  statusCode: number,
  body: any
): APIGatewayProxyResult {
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
        linkedTasks: task.linkedTasks.filter((id: string) => id !== linkedTaskId),
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
