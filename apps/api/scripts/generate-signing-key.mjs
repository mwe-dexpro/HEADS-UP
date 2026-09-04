// One-time setup helper: generates the EC (P-256) key pair used to sign
// access tokens (see src/lib/jwt.ts). Run with `npm run keys:generate` and
// paste the private JWK into `wrangler secret put JWT_SIGNING_KEY` (or into
// .dev.vars for local development) — never commit it.
import { generateKeyPair, exportJWK } from "jose";

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = await exportJWK(privateKey);
jwk.alg = "ES256";

console.log("Private JWK (JWT_SIGNING_KEY) — set this as a secret, do not commit it:\n");
console.log(JSON.stringify(jwk));
