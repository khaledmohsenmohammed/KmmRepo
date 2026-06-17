import type { Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import * as projectsService from '../services/projects.service.js';
import { listProjectsQuerySchema } from '../routes/projects.schemas.js';

export async function listProjects(req: Request, res: Response): Promise<void> {
  const parsed = listProjectsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid query parameters');
  }
  const projects = await projectsService.listProjects(parsed.data);
  res.json({ projects });
}

export async function createProject(req: Request, res: Response): Promise<void> {
  const project = await projectsService.createProject(req.user!.sub, req.body);
  res.status(201).json({ project });
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  const project = await projectsService.updateProject(req.user!.sub, req.params.id!, req.body);
  res.json({ project });
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  const project = await projectsService.softDeleteProject(req.user!.sub, req.params.id!);
  res.json({ project });
}

export async function restoreProject(req: Request, res: Response): Promise<void> {
  const project = await projectsService.restoreProject(req.user!.sub, req.params.id!);
  res.json({ project });
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  const members = await projectsService.listMembers(req.params.id!);
  res.json({ members });
}

export async function addMember(req: Request, res: Response): Promise<void> {
  const member = await projectsService.addMember(req.user!.sub, req.params.id!, req.body);
  res.status(201).json({ member });
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  await projectsService.removeMember(req.user!.sub, req.params.id!, req.params.userId!);
  res.json({ message: 'Member removed' });
}
