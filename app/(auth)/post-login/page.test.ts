import { describe, it, expect, vi, beforeEach } from "vitest";

const redirect = vi.fn();
let currentUser: { id: string; shortRef: string; slug?: string | null; onboardedAt?: Date | null } | null = null;

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}));
vi.mock("@/lib/identity/session", () => ({
  getCurrentUser: () => Promise.resolve(currentUser),
}));

import PostLoginPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = null;
});

describe("post-login dispatcher", () => {
  it("sends a logged-out visitor to /login", async () => {
    currentUser = null;
    await PostLoginPage();
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("sends a provisioned 正身 (has slug) to their public /gua page", async () => {
    currentUser = { id: "u1", shortRef: "abc123", slug: "alice" };
    await PostLoginPage();
    expect(redirect).toHaveBeenCalledWith("/gua/alice");
  });

  it("sends a slug-less but already-onboarded user to their /r card (not the wizard)", async () => {
    currentUser = { id: "u1", shortRef: "abc123", slug: null, onboardedAt: new Date("2026-06-01") };
    await PostLoginPage();
    expect(redirect).toHaveBeenCalledWith("/r/abc123");
  });

  it("sends a genuine first-timer (no slug, no onboardedAt) to onboarding", async () => {
    currentUser = { id: "u1", shortRef: "abc123", slug: null, onboardedAt: null };
    await PostLoginPage();
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });
});
