import { Router } from 'express';
import * as profileController from '../controllers/profile.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { updateProfileSchema } from './profile.schemas.js';

// Mounted behind requireAuth in routes/index.ts — every route is for the current user.
const router = Router();

router.get('/', asyncHandler(profileController.getProfile));
router.patch(
  '/',
  validateBody(updateProfileSchema),
  asyncHandler(profileController.updateProfile),
);

export default router;
