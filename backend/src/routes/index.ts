import { Router } from 'express';
import * as projectsController from '../controllers/projects.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import adminRoutes from './admin.js';
import authRoutes from './auth.js';
import folderRoutes from './folders.js';
import profileRoutes from './profile.js';
import projectRoutes from './projects.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/profile', requireAuth, profileRoutes);
// Member-facing: the caller's accessible projects (dashboard navigation).
router.get('/projects', requireAuth, asyncHandler(projectsController.listMyProjects));
// Member-facing: role-based access is enforced per-route by requireProjectAccess.
router.use('/projects/:projectId/folders', requireAuth, folderRoutes);
router.use('/admin/projects', requireAuth, requireSuperAdmin, projectRoutes);
router.use('/admin', requireAuth, requireSuperAdmin, adminRoutes);

export default router;
