import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';

/**
 * Authorizes super-admin-only routes. Must run AFTER `requireAuth`, which sets
 * `req.user` from the verified access token. Returns 403 for any non-super-admin.
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Super-admin access required');
  }
  next();
}
