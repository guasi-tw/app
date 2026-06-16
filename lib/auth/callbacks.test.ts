import { describe, it, expect } from "vitest";
import { isGoogleEmailVerified, signInCallback } from "./callbacks";

describe("isGoogleEmailVerified", () => {
  it("is true only when email_verified === true", () => {
    expect(isGoogleEmailVerified({ email_verified: true })).toBe(true);
  });
  it("is false for false / missing / non-boolean", () => {
    expect(isGoogleEmailVerified({ email_verified: false })).toBe(false);
    expect(isGoogleEmailVerified({})).toBe(false);
    expect(isGoogleEmailVerified({ email_verified: "true" })).toBe(false);
    expect(isGoogleEmailVerified(null)).toBe(false);
    expect(isGoogleEmailVerified(undefined)).toBe(false);
  });
});

describe("signInCallback", () => {
  it("rejects a Google sign-in with an unverified email", async () => {
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { email_verified: false },
    } as never);
    expect(ok).toBe(false);
  });
  it("allows a Google sign-in with a verified email", async () => {
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { email_verified: true },
    } as never);
    expect(ok).toBe(true);
  });
  it("allows non-Google providers unchanged", async () => {
    const ok = await signInCallback({ account: { provider: "email" }, profile: {} } as never);
    expect(ok).toBe(true);
  });
});
