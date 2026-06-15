import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { userStatusUpdateSchema } from './admin.schemas.js';

const router = Router();

router.get('/users', asyncHandler(adminController.listUsers));
router.patch(
  '/users/:id',
  validateBody(userStatusUpdateSchema),
  asyncHandler(adminController.updateUserStatus),
);
router.delete('/users/:id', asyncHandler(adminController.deleteUser));
router.post('/users/:id/restore', asyncHandler(adminController.restoreUser));

export default router;
