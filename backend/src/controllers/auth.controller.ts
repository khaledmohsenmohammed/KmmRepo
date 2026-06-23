import type { CookieOptions, Request, Response } from 'express';
import { isProd } from '../config/env.js';
import * as authService from '../services/auth.service.js';

const REFRESH_COOKIE = 'refreshToken';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  // In production the frontend and API are on separate *.run.app sites, so the
  // refresh cookie must be SameSite=None (requires Secure) to be sent cross-site.
  // Locally everything is same-site on localhost, so keep the stricter default.
  sameSite: isProd ? 'none' : 'strict',
  // Only sent to the auth routes that need it.
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions);
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, maxAge: undefined });
}

export async function register(req: Request, res: Response): Promise<void> {
  const user = await authService.register(req.body);
  res.status(201).json({
    message: 'Registration submitted. An administrator will approve your account.',
    user,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await authService.login(req.body);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(200).json({ user, accessToken: tokens.accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const { user, tokens } = await authService.refresh(token);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(200).json({ user, accessToken: tokens.accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(token);
  clearRefreshCookie(res);
  res.status(200).json({ message: 'Logged out' });
}
