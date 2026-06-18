export const GOOGLE_IDENTITY_SCOPES = ["openid", "email", "profile"] as const;

export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

export const GOOGLE_OAUTH_SCOPES = [
  ...GOOGLE_IDENTITY_SCOPES,
  ...GMAIL_OAUTH_SCOPES,
] as const;

export const GOOGLE_OAUTH_SCOPE = GOOGLE_OAUTH_SCOPES.join(" ");

export const GOOGLE_OAUTH_AUTHORIZATION_PARAMS = {
  access_type: "offline",
  prompt: "consent",
  response_type: "code",
  include_granted_scopes: "true",
  scope: GOOGLE_OAUTH_SCOPE,
} as const;

export function parseOAuthScope(scope: string | null | undefined): Set<string> {
  return new Set(scope?.split(/\s+/).filter(Boolean) ?? []);
}

export function missingGmailScopes(
  scope: string | null | undefined,
): (typeof GMAIL_OAUTH_SCOPES)[number][] {
  const grantedScopes = parseOAuthScope(scope);
  return GMAIL_OAUTH_SCOPES.filter((required) => !grantedScopes.has(required));
}

export function hasRequiredGmailScopes(
  scope: string | null | undefined,
): boolean {
  return missingGmailScopes(scope).length === 0;
}
