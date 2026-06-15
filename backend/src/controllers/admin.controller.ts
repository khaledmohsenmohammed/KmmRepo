import type { Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import * as adminService from '../services/admin.service.js';
import { listUsersQuerySchema } from '../routes/admin.schemas.js';

export async function listUsers(req: Request, res: Response): Promise<void> {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid query parameters');
  }
  const users = await adminService.listUsers(parsed.data);
  res.json({ users });
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  const actingUserId = req.user!.sub;
  const user = await adminService.setUserStatus(actingUserId, req.params.id!, req.body.status);
  res.json({ user });
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const actingUserId = req.user!.sub;
  const user = await adminService.softDeleteUser(actingUserId, req.params.id!);
  res.json({ user });
}

export async function restoreUser(req: Request, res: Response): Promise<void> {
  const actingUserId = req.user!.sub;
  const user = await adminService.restoreUser(actingUserId, req.params.id!);
  res.json({ user });
}
