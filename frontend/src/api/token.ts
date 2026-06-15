/**
 * In-memory access token store. The access token is intentionally NOT persisted
 * to localStorage — it lives only in memory and is re-obtained via the httpOnly
 * refresh cookie on page load. This limits XSS token theft.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
