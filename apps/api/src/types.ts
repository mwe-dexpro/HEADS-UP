export interface Env {
  DB: D1Database;

  // Non-secret config (wrangler.toml [vars]).
  MS_TENANT: string;
  MS_CLIENT_ID: string;
  API_BASE_URL: string;
  /** Comma-separated exact origins allowed to call this API — origin only
   * (scheme+host+port), no path: it's compared against the browser's
   * Origin header, which never carries one. */
  FRONTEND_ORIGINS: string;
  /** Path the SPA is actually served under — "/" at a domain root, or
   * e.g. "/HEADS-UP/" for a GitHub Pages project site. Used only to build
   * the OAuth callback's redirect target; see routes/auth.ts and
   * docs/DECISIONS.md ADR-020. */
  FRONTEND_APP_PATH: string;

  // Secrets (`wrangler secret put`, or .dev.vars locally) — never in wrangler.toml.
  MS_CLIENT_SECRET: string;
  /** Private EC (P-256) JWK, JSON string. See src/lib/jwt.ts. */
  JWT_SIGNING_KEY: string;
  /** Pepper for hashing refresh tokens. See src/lib/crypto.ts. */
  REFRESH_TOKEN_PEPPER: string;
}

/** Set by middleware/auth.ts once the bearer token is verified. */
export interface AuthVariables {
  userId: string;
  userEmail: string;
}
