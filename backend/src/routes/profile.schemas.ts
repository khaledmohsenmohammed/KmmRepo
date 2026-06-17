import { z } from 'zod';

// A base64 data URL for the avatar image, e.g. "data:image/png;base64,iVBORw0...".
// Capped to keep request/response/DB sizes reasonable (~3MB of base64 ≈ 2.2MB image).
const MAX_AVATAR_DATA_URL = 3_000_000;

const avatarDataUrl = z
  .string()
  .max(MAX_AVATAR_DATA_URL, 'Image is too large (max ~2MB). Please choose a smaller image.')
  .regex(/^data:image\/(png|jpe?g|gif|webp);base64,/, 'Avatar must be an image');

// All fields optional: a PATCH may update any subset.
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    avatarName: z.string().trim().max(100, 'Avatar name is too long'),
    avatarDescription: z.string().trim().max(500, 'Avatar description is too long'),
    avatar: avatarDataUrl,
  })
  .partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
