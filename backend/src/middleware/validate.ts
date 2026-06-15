import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ApiError } from '../lib/errors.js';

/**
 * Validates `req.body` against a Zod schema. On success, replaces the body with
 * the parsed (typed) value and calls next(). On failure, throws a 400 ApiError
 * carrying field-level messages.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const path = issue.path.join('.') || '_';
          (fields[path] ??= []).push(issue.message);
        }
        next(ApiError.badRequest('Validation failed', fields));
        return;
      }
      next(err);
    }
  };
}
