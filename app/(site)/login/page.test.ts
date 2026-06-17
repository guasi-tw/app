import { describe, it, expect, vi, beforeEach } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

// Login page imports signIn for the form's server action; never invoked in render.
vi.mock("@/lib/auth", () => ({ signIn: vi.fn() }));

let currentUser: { slug: string | null; shortRef: string } | null = null;
vi.mock("@/lib/identity/session", () => ({
  getCurrentUser: () => Promise.resolve(currentUser),
}));

import LoginPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = null;
});

describe("/login page", () => {
  it("logged-in owner with a slug → redirected to the public card", async () => {
    currentUser = { slug: "alice", shortRef: "x9" };
    await expect(LoginPage()).rejects.toThrow("redirect:/gua/alice");
    expect(redirect).toHaveBeenCalledWith("/gua/alice");
  });

  it("logged-in owner without a slug → redirected to the short link", async () => {
    currentUser = { slug: null, shortRef: "x9" };
    await expect(LoginPage()).rejects.toThrow("redirect:/r/x9");
    expect(redirect).toHaveBeenCalledWith("/r/x9");
  });

  it("logged-out visitor → renders the login form (no redirect)", async () => {
    currentUser = null;
    const out = await LoginPage();
    expect(out).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
