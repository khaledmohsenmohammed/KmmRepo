import { z } from 'zod';

export const userStatusUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export const listUsersQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'DISABLED']).optional(),
  deleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type UserStatusUpdateInput = z.infer<typeof userStatusUpdateSchema>;
