import type { Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import * as foldersService from '../services/folders.service.js';
import { FOLDER_MANAGE_ROLES } from '../middleware/requireProjectAccess.js';
import { listFoldersQuerySchema, restoreFolderQuerySchema } from '../routes/folders.schemas.js';

export async function listFolders(req: Request, res: Response): Promise<void> {
  const parsed = listFoldersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid query parameters');
  }
  const result = await foldersService.listFolders(req.projectAccess!.projectId, parsed.data);
  // Tell the client whether this caller may manage folders, so the UI can hide
  // create/rename/move/delete controls for view-only members.
  const access = req.projectAccess!;
  const canManage = access.isSuperAdmin || (access.role !== null && FOLDER_MANAGE_ROLES.has(access.role));
  res.json({ ...result, canManage });
}

export async function createFolder(req: Request, res: Response): Promise<void> {
  const folder = await foldersService.createFolder(
    req.user!.sub,
    req.projectAccess!.projectId,
    req.body,
  );
  res.status(201).json({ folder });
}

export async function renameFolder(req: Request, res: Response): Promise<void> {
  const folder = await foldersService.renameFolder(
    req.user!.sub,
    req.projectAccess!.projectId,
    req.params.id!,
    req.body.name,
  );
  res.json({ folder });
}

export async function moveFolder(req: Request, res: Response): Promise<void> {
  const folder = await foldersService.moveFolder(
    req.user!.sub,
    req.projectAccess!.projectId,
    req.params.id!,
    req.body.parentId,
  );
  res.json({ folder });
}

export async function deleteFolder(req: Request, res: Response): Promise<void> {
  const result = await foldersService.softDeleteFolder(
    req.user!.sub,
    req.projectAccess!.projectId,
    req.params.id!,
  );
  res.json(result);
}

export async function restoreFolder(req: Request, res: Response): Promise<void> {
  const parsed = restoreFolderQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid query parameters');
  }
  const result = await foldersService.restoreFolder(
    req.user!.sub,
    req.projectAccess!.projectId,
    req.params.id!,
    parsed.data.cascade ?? false,
  );
  res.json(result);
}
