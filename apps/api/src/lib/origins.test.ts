import { describe, expect, it } from "vitest";
import type { Env } from "../types.js";
import { allowedOrigins, isAllowedOrigin } from "./origins.js";

function envWith(frontendOrigins: string): Env {
  return { FRONTEND_ORIGINS: frontendOrigins } as Env;
}

describe("allowedOrigins", () => {
  it("splits a comma-separated list into a set of exact origins", () => {
    const origins = allowedOrigins(envWith("https://a.example,https://b.example"));
    expect(origins).toEqual(new Set(["https://a.example", "https://b.example"]));
  });

  it("trims surrounding whitespace around each origin", () => {
    const origins = allowedOrigins(envWith(" https://a.example , https://b.example "));
    expect(origins).toEqual(new Set(["https://a.example", "https://b.example"]));
  });

  it("handles a single configured origin", () => {
    const origins = allowedOrigins(envWith("https://only.example"));
    expect(origins).toEqual(new Set(["https://only.example"]));
  });
});

describe("isAllowedOrigin", () => {
  const env = envWith("https://a.example,https://b.example");

  it("accepts an origin that's in the allow-list", () => {
    expect(isAllowedOrigin(env, "https://a.example")).toBe(true);
  });

  it("rejects an origin that's not in the allow-list", () => {
    expect(isAllowedOrigin(env, "https://evil.example")).toBe(false);
  });

  it("rejects undefined (no Origin header at all)", () => {
    expect(isAllowedOrigin(env, undefined)).toBe(false);
  });

  it("rejects a scheme/host match with a different port or subdomain", () => {
    expect(isAllowedOrigin(env, "https://a.example:8443")).toBe(false);
    expect(isAllowedOrigin(env, "https://evil.a.example")).toBe(false);
  });

  it("is not fooled by a value that's merely a substring of an allowed origin", () => {
    expect(isAllowedOrigin(env, "a.example")).toBe(false);
  });
});
