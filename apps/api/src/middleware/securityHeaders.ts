import type { MiddlewareHandler } from "hono";

/**
 * This is a pure JSON API — no route ever renders HTML — so the CSP simply
 * forbids everything, HSTS forces HTTPS on every future request, and
 * nosniff/no-referrer close off the usual content-sniffing/referrer-leak
 * paths. See docs/THREAT-MODEL.md "Tampering" (HTTPS/HSTS).
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Content-Security-Policy", "default-src 'none'");
  c.header("X-Frame-Options", "DENY");
};
