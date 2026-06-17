import { api } from './client';

export type ProjectRole =
  | 'TEST_LEAD'
  | 'AUTOMATION_TESTER'
  | 'MANUAL_TESTER'
  | 'PENTESTER'
  | 'PROJECT_LEAD';

export const PROJECT_ROLES: ProjectRole[] = [
  'PROJECT_LEAD',
  'TEST_LEAD',
  'AUTOMATION_TESTER',
  'MANUAL_TESTER',
  'PENTESTER',
];

export interface Project {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  isDeleted: boolean;
  createdAt: string;
}

export interface ProjectMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  grantedAt: string;
}

export interface ListProjectsParams {
  deleted?: boolean;
}

export async function listProjects(params: ListProjectsParams = {}): Promise<Project[]> {
  const res = await api.get('/admin/projects', {
    params: { ...(params.deleted ? { deleted: 'true' } : {}) },
  });
  return res.data.projects;
}

export async function createProject(input: {
  name: string;
  description?: string;
}): Promise<Project> {
  const res = await api.post('/admin/projects', input);
  return res.data.project;
}

export async function updateProject(
  id: string,
  input: { name?: string; description?: string },
): Promise<Project> {
  const res = await api.patch(`/admin/projects/${id}`, input);
  return res.data.project;
}

export async function deleteProject(id: string): Promise<Project> {
  const res = await api.delete(`/admin/projects/${id}`);
  return res.data.project;
}

export async function restoreProject(id: string): Promise<Project> {
  const res = await api.post(`/admin/projects/${id}/restore`);
  return res.data.project;
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const res = await api.get(`/admin/projects/${projectId}/members`);
  return res.data.members;
}

export async function addMember(
  projectId: string,
  input: { userId: string; role: ProjectRole },
): Promise<ProjectMember> {
  const res = await api.post(`/admin/projects/${projectId}/members`, input);
  return res.data.member;
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await api.delete(`/admin/projects/${projectId}/members/${userId}`);
}
