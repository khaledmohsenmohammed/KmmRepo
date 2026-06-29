import { Router } from 'express';
import * as foldersController from '../controllers/folders.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { requireProjectAccess } from '../middleware/requireProjectAccess.js';
import { createFolderSchema, moveFolderSchema, renameFolderSchema } from './folders.schemas.js';

// Mounted at /projects/:projectId/folders behind requireAuth (routes/index.ts).
// mergeParams lets this child router read :projectId from the parent path.
// Per-action role gating is applied by requireProjectAccess({ manage }).
const router = Router({ mergeParams: true });

router.get('/', requireProjectAccess(), asyncHandler(foldersController.listFolders));

router.post(
  '/',
  requireProjectAccess({ manage: true }),
  validateBody(createFolderSchema),
  asyncHandler(foldersController.createFolder),
);

router.patch(
  '/:id',
  requireProjectAccess({ manage: true }),
  validateBody(renameFolderSchema),
  asyncHandler(foldersController.renameFolder),
);

router.post(
  '/:id/move',
  requireProjectAccess({ manage: true }),
  validateBody(moveFolderSchema),
  asyncHandler(foldersController.moveFolder),
);

router.delete('/:id', requireProjectAccess({ manage: true }), asyncHandler(foldersController.deleteFolder));

router.post(
  '/:id/restore',
  requireProjectAccess({ manage: true }),
  asyncHandler(foldersController.restoreFolder),
);

export default router;
