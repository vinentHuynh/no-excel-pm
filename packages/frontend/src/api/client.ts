import { fetchAuthSession } from 'aws-amplify/auth';
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../../../shared/types';

// Get API endpoint from environment variable
// You'll need to set this after deploying the CDK stack
const API_ENDPOINT =
  import.meta.env.VITE_API_ENDPOINT ||
  'https://your-api-endpoint.execute-api.us-east-1.amazonaws.com/prod';

class ApiClient {
  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      return {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      };
    } catch (error) {
      console.error('Error getting auth session:', error);
      throw new Error('Not authenticated');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${API_ENDPOINT}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Request failed' }));
      throw new Error(
        error.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  // Tasks endpoints
  async getTasks(): Promise<{ tasks: Task[] }> {
    return this.request<{ tasks: Task[] }>('/tasks');
  }

  async getTask(taskId: string): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(`/tasks/${taskId}`);
  }

  async createTask(data: CreateTaskRequest): Promise<{ task: Task }> {
    return this.request<{ task: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(
    taskId: string,
    data: UpdateTaskRequest
  ): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(taskId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async addComment(taskId: string, comment: string): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async linkTask(
    taskId: string,
    linkedTaskId: string
  ): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(`/tasks/${taskId}/link`, {
      method: 'POST',
      body: JSON.stringify({ linkedTaskId }),
    });
  }

  async unlinkTask(
    taskId: string,
    linkedTaskId: string
  ): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(
      `/tasks/${taskId}/link/${linkedTaskId}`,
      {
        method: 'DELETE',
      }
    );
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
