import { Router } from 'express';
import * as projectsController from '../controllers/projects.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { addMemberSchema, createProjectSchema, updateProjectSchema } from './projects.schemas.js';

// Mounted at /admin/projects behind requireAuth + requireSuperAdmin (routes/index.ts).
const router = Router();

router.get('/', asyncHandler(projectsController.listProjects));
router.post('/', validateBody(createProjectSchema), asyncHandler(projectsController.createProject));
router.patch(
  '/:id',
  validateBody(updateProjectSchema),
  asyncHandler(projectsController.updateProject),
);
router.delete('/:id', asyncHandler(projectsController.deleteProject));
router.post('/:id/restore', asyncHandler(projectsController.restoreProject));

router.get('/:id/members', asyncHandler(projectsController.listMembers));
router.post(
  '/:id/members',
  validateBody(addMemberSchema),
  asyncHandler(projectsController.addMember),
);
router.delete('/:id/members/:userId', asyncHandler(projectsController.removeMember));

export default router;
