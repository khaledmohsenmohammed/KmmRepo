import { z } from 'zod';

const PROJECT_ROLES = [
  'TEST_LEAD',
  'AUTOMATION_TESTER',
  'MANUAL_TESTER',
  'PENTESTER',
  'PROJECT_LEAD',
] as const;

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().trim().max(500, 'Description is too long').optional(),
});

// Any subset; at least the shape is validated. (Empty body simply changes nothing.)
export const updateProjectSchema = createProjectSchema.partial();

export const addMemberSchema = z.object({
  userId: z.string().min(1, 'A user is required'),
  role: z.enum(PROJECT_ROLES),
});

export const listProjectsQuerySchema = z.object({
  deleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
