import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import adminRoutes from './admin.js';
import authRoutes from './auth.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/admin', requireAuth, requireSuperAdmin, adminRoutes);

export default router;
