import { describe, it, expect, vi, beforeEach } from "vitest";

let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/identity/session", () => ({
  getCurrentUser: () => Promise.resolve(currentUser),
}));
// Stub the presentational children so the test doesn't pull in CSS / server actions.
vi.mock("./HowItWorks", () => ({ HowItWorks: () => null }));
vi.mock("./ExampleCard", () => ({ ExampleCard: () => null }));
vi.mock("./LandingCta", () => ({ LandingCta: () => null }));

import Home from "./page";

beforeEach(() => {
  currentUser = null;
});

describe("/ homepage", () => {
  it("renders for a logged-out visitor", async () => {
    currentUser = null;
    const el = await Home();
    expect(el).toBeTruthy();
  });

  it("renders for a logged-in owner", async () => {
    currentUser = { id: "u1", slug: "meimei", shortRef: "abc" };
    const el = await Home();
    expect(el).toBeTruthy();
  });
});
