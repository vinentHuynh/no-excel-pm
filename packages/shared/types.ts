// Shared types for the Paroview application
// Single table design with domain isolation

export type TaskStatus = 'backlog' | 'in-progress' | 'completed';

export type ActivityType =
  | 'comment'
  | 'status_change'
  | 'assignment'
  | 'hours_update'
  | 'created';

export interface Activity {
  id: string;
  type: ActivityType;
  text: string;
  author: string;
  timestamp: string; // ISO date string for JSON serialization
  metadata?: {
    oldValue?: string;
    newValue?: string;
    fieldName?: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  activities: Activity[];
  hoursSpent: number;
  hoursExpected: number;
  assignedTo: string;
  linkedTasks: string[]; // Array of task IDs
  domain: string; // Company/organization domain
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  taskIds: string[]; // References to task IDs
  domain: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  domain: string; // Company/organization domain
  role: 'admin' | 'member';
  createdAt: string;
  updatedAt: string;
}

// DynamoDB Item structure using single table design
// PK format: DOMAIN#{domain}#TYPE#{entityType}#ID#{id}
// SK format: META or RELATION#{relationType}#{relatedId}

export interface DynamoDBItem {
  PK: string; // Partition Key: "DOMAIN#companyA#TASK#task123"
  SK: string; // Sort Key: "META" for main item, or "RELATION#..." for relationships
  GSI1PK?: string; // Global Secondary Index 1 PK for queries
  GSI1SK?: string; // Global Secondary Index 1 SK
  entityType: 'TASK' | 'SPRINT' | 'USER' | 'ACTIVITY';
  domain: string;
  data: Task | Sprint | UserProfile | Activity;
  createdAt: string;
  updatedAt: string;
}

// API Request/Response types
export interface CreateTaskRequest {
  title: string;
  description: string;
  status: TaskStatus;
  hoursExpected: number;
  assignedTo?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  hoursSpent?: number;
  hoursExpected?: number;
  assignedTo?: string;
  linkedTasks?: string[];
}

export interface AddCommentRequest {
  taskId: string;
  comment: string;
}

export interface LinkTaskRequest {
  taskId: string;
  linkedTaskId: string;
}

export interface GetTasksResponse {
  tasks: Task[];
}

export interface CreateTaskResponse {
  task: Task;
}

export interface UpdateTaskResponse {
  task: Task;
}

export interface DeleteTaskResponse {
  success: boolean;
}

// User API Request/Response types
export interface CreateUserRequest {
  email: string;
  name: string;
  role: 'admin' | 'member';
}

export interface UpdateUserRequest {
  name?: string;
  role?: 'admin' | 'member';
}

export interface GetUsersResponse {
  users: UserProfile[];
}

export interface CreateUserResponse {
  user: UserProfile;
}

export interface UpdateUserResponse {
  user: UserProfile;
}

export interface DeleteUserResponse {
  success: boolean;
}

// Helper function to build DynamoDB keys
export function buildTaskPK(domain: string, taskId: string): string {
  return `DOMAIN#${domain}#TASK#${taskId}`;
}

export function buildSprintPK(domain: string, sprintId: string): string {
  return `DOMAIN#${domain}#SPRINT#${sprintId}`;
}

export function buildUserPK(domain: string, userId: string): string {
  return `DOMAIN#${domain}#USER#${userId}`;
}

export function buildMetaSK(): string {
  return 'META';
}

export function buildDomainGSI1PK(domain: string, entityType: string): string {
  return `DOMAIN#${domain}#TYPE#${entityType}`;
}

// Helper to extract email domain
export function extractDomain(email: string): string {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}
