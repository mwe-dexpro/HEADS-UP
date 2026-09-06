import { describe, expect, it } from "vitest";
import { hmacSha256Hex, pkceChallengeFromVerifier, randomToken } from "./crypto.js";

describe("randomToken", () => {
  it("produces a base64url string with no padding or reserved characters", () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("scales output length with the requested byte count", () => {
    expect(randomToken(16).length).toBeLessThan(randomToken(32).length);
  });

  it("never repeats across calls", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken(32)));
    expect(tokens.size).toBe(50);
  });
});

describe("hmacSha256Hex", () => {
  it("is deterministic for the same pepper and value", async () => {
    const a = await hmacSha256Hex("pepper", "value");
    const b = await hmacSha256Hex("pepper", "value");
    expect(a).toBe(b);
  });

  it("changes when the value changes", async () => {
    const a = await hmacSha256Hex("pepper", "value-1");
    const b = await hmacSha256Hex("pepper", "value-2");
    expect(a).not.toBe(b);
  });

  it("changes when the pepper changes", async () => {
    const a = await hmacSha256Hex("pepper-a", "value");
    const b = await hmacSha256Hex("pepper-b", "value");
    expect(a).not.toBe(b);
  });

  it("is a 64-character lowercase hex string (SHA-256 output)", async () => {
    const digest = await hmacSha256Hex("pepper", "value");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("pkceChallengeFromVerifier", () => {
  // RFC 7636 Appendix B's worked example — a fixed known-answer test, not
  // just "it runs and returns something".
  it("matches the RFC 7636 Appendix B test vector", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await pkceChallengeFromVerifier(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("is deterministic for the same verifier", async () => {
    const a = await pkceChallengeFromVerifier("some-verifier-value");
    const b = await pkceChallengeFromVerifier("some-verifier-value");
    expect(a).toBe(b);
  });
});
