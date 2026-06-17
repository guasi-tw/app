import { describe, it, expect, vi, beforeEach } from "vitest";

const redirect = vi.fn();
let currentUser: { id: string; shortRef: string; slug?: string | null } | null = null;

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

  it("sends a not-yet-provisioned user (no slug) to onboarding", async () => {
    currentUser = { id: "u1", shortRef: "abc123", slug: null };
    await PostLoginPage();
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });
});
