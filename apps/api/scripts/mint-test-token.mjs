// Dev-only helper: mints an access token for a given user id/email using the
// same JWT_SIGNING_KEY as `wrangler dev` (read from .dev.vars), so the CRUD
// routes can be smoke-tested with curl without a real Microsoft sign-in.
// Not part of the deployed app — deliberately not imported anywhere in src/.
import { readFileSync } from "node:fs";
import { SignJWT, importJWK } from "jose";

const devVars = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const jwk = JSON.parse(devVars.JWT_SIGNING_KEY);
const key = await importJWK(jwk, "ES256");
const [sub, email] = process.argv.slice(2);
const token = await new SignJWT({ email })
  .setProtectedHeader({ alg: "ES256" })
  .setSubject(sub)
  .setIssuer("heads-up-api")
  .setAudience("heads-up-web")
  .setIssuedAt()
  .setExpirationTime("15m")
  .sign(key);
console.log(token);
