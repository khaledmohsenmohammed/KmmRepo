import type { Project, ProjectMembership, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import type {
  AddMemberInput,
  CreateProjectInput,
  UpdateProjectInput,
} from '../routes/projects.schemas.js';

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  isDeleted: boolean;
  createdAt: Date;
}

export interface ProjectMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  grantedAt: Date;
}

function toProjectSummary(project: Project, memberCount: number): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    memberCount,
    isDeleted: project.isDeleted,
    createdAt: project.createdAt,
  };
}

function toProjectMember(m: ProjectMembership & { user: User }): ProjectMember {
  return {
    membershipId: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    grantedAt: m.grantedAt,
  };
}

export interface MyProject {
  id: string;
  name: string;
  description: string | null;
  myRole: string | null;
}

/**
 * Lists the active projects the caller can access: all of them for a super-admin,
 * or just the ones they're a member of (with their role) for a regular user.
 * Member-facing — used by the dashboard to navigate into folder trees.
 */
export async function listMyProjects(userId: string, isSuperAdmin: boolean): Promise<MyProject[]> {
  if (isSuperAdmin) {
    const projects = await prisma.project.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      myRole: null,
    }));
  }
  const memberships = await prisma.projectMembership.findMany({
    where: { userId, project: { isDeleted: false } },
    include: { project: true },
    orderBy: { grantedAt: 'desc' },
  });
  return memberships.map((m) => ({
    id: m.project.id,
    name: m.project.name,
    description: m.project.description,
    myRole: m.role,
  }));
}

export interface ListProjectsParams {
  deleted?: boolean;
}

export async function listProjects(params: ListProjectsParams): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { isDeleted: params.deleted ?? false },
    include: { _count: { select: { memberships: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return projects.map((p) => toProjectSummary(p, p._count.memberships));
}

/** Loads an active (non-deleted) project or throws 404. */
async function loadActiveProject(id: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.isDeleted) {
    throw ApiError.notFound('Project not found');
  }
  return project;
}

export async function createProject(
  actingUserId: string,
  input: CreateProjectInput,
): Promise<ProjectSummary> {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      createdBy: actingUserId,
    },
  });
  audit('CREATE_PROJECT', { type: 'Project', id: project.id }, { by: actingUserId });
  return toProjectSummary(project, 0);
}

export async function updateProject(
  actingUserId: string,
  id: string,
  input: UpdateProjectInput,
): Promise<ProjectSummary> {
  await loadActiveProject(id);
  const data: { name?: string; description?: string | null } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;

  const updated = await prisma.project.update({
    where: { id },
    data,
    include: { _count: { select: { memberships: true } } },
  });
  audit('UPDATE_PROJECT', { type: 'Project', id }, { by: actingUserId, fields: Object.keys(data) });
  return toProjectSummary(updated, updated._count.memberships);
}

export async function softDeleteProject(
  actingUserId: string,
  id: string,
): Promise<ProjectSummary> {
  await loadActiveProject(id);
  const updated = await prisma.project.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date(), deletedBy: actingUserId },
    include: { _count: { select: { memberships: true } } },
  });
  audit('DELETE', { type: 'Project', id }, { by: actingUserId });
  return toProjectSummary(updated, updated._count.memberships);
}

export async function restoreProject(
  actingUserId: string,
  id: string,
): Promise<ProjectSummary> {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw ApiError.notFound('Project not found');
  }
  const updated = await prisma.project.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null, deletedBy: null },
    include: { _count: { select: { memberships: true } } },
  });
  audit('RESTORE', { type: 'Project', id }, { by: actingUserId });
  return toProjectSummary(updated, updated._count.memberships);
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  await loadActiveProject(projectId);
  const members = await prisma.projectMembership.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: { grantedAt: 'asc' },
  });
  return members.map(toProjectMember);
}

/** Assign a user to a project (or update their role if already a member). */
export async function addMember(
  actingUserId: string,
  projectId: string,
  input: AddMemberInput,
): Promise<ProjectMember> {
  await loadActiveProject(projectId);

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.isDeleted) {
    throw ApiError.notFound('User not found');
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.badRequest('Only active users can be assigned to a project');
  }

  const membership = await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId: input.userId, projectId } },
    create: {
      userId: input.userId,
      projectId,
      role: input.role,
      grantedBy: actingUserId,
    },
    update: { role: input.role, grantedBy: actingUserId },
    include: { user: true },
  });
  audit(
    'ASSIGN_MEMBER',
    { type: 'ProjectMembership', id: membership.id },
    { by: actingUserId, projectId, userId: input.userId, role: input.role },
  );
  return toProjectMember(membership);
}

export async function removeMember(
  actingUserId: string,
  projectId: string,
  userId: string,
): Promise<void> {
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership) {
    throw ApiError.notFound('Membership not found');
  }
  await prisma.projectMembership.delete({ where: { id: membership.id } });
  audit(
    'REMOVE_MEMBER',
    { type: 'ProjectMembership', id: membership.id },
    { by: actingUserId, projectId, userId },
  );
}
