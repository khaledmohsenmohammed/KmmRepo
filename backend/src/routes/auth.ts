import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

const router = Router();

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(authController.register),
);
router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(authController.login),
);
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));

export default router;
