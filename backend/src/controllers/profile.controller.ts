import type { Request, Response } from 'express';
import * as profileService from '../services/profile.service.js';

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = await profileService.getProfile(req.user!.sub);
  res.status(200).json({ user });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = await profileService.updateProfile(req.user!.sub, req.body);
  res.status(200).json({ user });
}
