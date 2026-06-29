import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  // Omitted or null => root folder.
  parentId: z.string().cuid().nullable().optional(),
});

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
});

export const moveFolderSchema = z.object({
  // null => move to root.
  parentId: z.string().cuid().nullable(),
});

export const listFoldersQuerySchema = z.object({
  deleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const restoreFolderQuerySchema = z.object({
  cascade: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;
export type MoveFolderInput = z.infer<typeof moveFolderSchema>;
