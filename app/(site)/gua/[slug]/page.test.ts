import { describe, it, expect, vi, beforeEach } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("notFound");
});
const redirect = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  redirect: (url: string) => redirect(url),
}));

type User = {
  id: string;
  slug: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

let user: User | null = null;
let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/identity/repo", () => ({
  findUserBySlug: () => Promise.resolve(user),
}));
vi.mock("@/lib/identity/session", () => ({
  getCurrentUser: () => Promise.resolve(currentUser),
}));
vi.mock("./accounts", () => ({
  buildAccountGroups: () =>
    Promise.resolve({
      accounts: { main: null, active: [], flagged: [], private: [] },
      count: 0,
    }),
}));
vi.mock("./IdentityCard", () => ({
  IdentityCard: (props: Record<string, unknown>) => props,
}));

import IdentityCardPage from "./page";

function call(slug: string, view?: string) {
  return IdentityCardPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(view ? { view } : {}),
  }) as Promise<{ props: Record<string, unknown> }>;
}

beforeEach(() => {
  vi.clearAllMocks();
  user = { id: "u1", slug: "alice", displayName: "Alice", bio: null, avatarUrl: null };
  currentUser = null;
});

describe("/gua/[slug] page", () => {
  it("unknown slug → notFound", async () => {
    user = null;
    await expect(call("nobody")).rejects.toThrow("notFound");
  });

  it("owner with ?view=manage → starts on the management tab", async () => {
    currentUser = { id: "u1", slug: "alice", shortRef: "x" };
    const { props } = await call("alice", "manage");
    expect(props.isOwner).toBe(true);
    expect(props.initialManage).toBe(true);
  });

  it("owner without ?view=manage → starts on the public view", async () => {
    currentUser = { id: "u1", slug: "alice", shortRef: "x" };
    const { props } = await call("alice");
    expect(props.initialManage).toBe(false);
  });

  it("non-owner with ?view=manage → redirected to the clean public URL", async () => {
    currentUser = { id: "someone-else", slug: null, shortRef: "y" };
    await expect(call("alice", "manage")).rejects.toThrow("redirect:/gua/alice");
    expect(redirect).toHaveBeenCalledWith("/gua/alice");
  });

  it("logged-out visitor with ?view=manage → redirected to the clean public URL", async () => {
    currentUser = null;
    await expect(call("alice", "manage")).rejects.toThrow("redirect:/gua/alice");
    expect(redirect).toHaveBeenCalledWith("/gua/alice");
  });

  it("non-owner without ?view=manage → public view, not owner", async () => {
    currentUser = { id: "someone-else", slug: null, shortRef: "y" };
    const { props } = await call("alice");
    expect(props.isOwner).toBe(false);
    expect(props.initialManage).toBe(false);
  });
});
