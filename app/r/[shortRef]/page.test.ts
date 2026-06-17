import { describe, it, expect, vi, beforeEach } from "vitest";

// redirect/permanentRedirect halt execution by throwing in Next; mirror that so
// code after a redirect doesn't run (matching production control flow).
const redirect = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
const permanentRedirect = vi.fn((url: string) => {
  throw new Error(`permanentRedirect:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  permanentRedirect: (url: string) => permanentRedirect(url),
}));

type Owner = {
  id: string;
  shortRef: string;
  slug: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

let owner: Owner | null = null;
let currentUser: { id: string } | null = null;

vi.mock("@/lib/identity/session", () => ({
  getCurrentUser: () => Promise.resolve(currentUser),
}));
vi.mock("@/lib/identity/repo", () => ({
  findUserByShortRef: () => Promise.resolve(owner),
}));

const buildAccountGroups = vi.fn((..._args: unknown[]) =>
  Promise.resolve({
    accounts: { main: null, active: [], flagged: [], private: [] },
    count: 0,
  }),
);
vi.mock("@/app/gua/[slug]/accounts", () => ({
  buildAccountGroups: (...args: unknown[]) => buildAccountGroups(...args),
}));

// Mock the (client) card so the test stays in node env and we can inspect props.
vi.mock("@/app/gua/[slug]/IdentityCard", () => ({
  IdentityCard: (props: Record<string, unknown>) => props,
}));

import ShortRefPage from "./page";

function call(shortRef = "P4pXRD3fC7") {
  return ShortRefPage({ params: Promise.resolve({ shortRef }) });
}

const fullOwner = (over: Partial<Owner> = {}): Owner => ({
  id: "u1",
  shortRef: "P4pXRD3fC7",
  slug: null,
  displayName: "Alice",
  bio: "hi",
  avatarUrl: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  owner = null;
  currentUser = null;
});

describe("/r/[shortRef] router", () => {
  it("unknown short-ref → main page", async () => {
    owner = null;
    await expect(call()).rejects.toThrow("redirect:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("has slug + owner → public page's management tab", async () => {
    owner = fullOwner({ slug: "alice" });
    currentUser = { id: "u1" };
    await expect(call()).rejects.toThrow("redirect:/gua/alice?view=manage");
    expect(redirect).toHaveBeenCalledWith("/gua/alice?view=manage");
  });

  it("has slug + logged-out → public page", async () => {
    owner = fullOwner({ slug: "alice" });
    currentUser = null;
    await expect(call()).rejects.toThrow("permanentRedirect:/gua/alice");
    expect(permanentRedirect).toHaveBeenCalledWith("/gua/alice");
  });

  it("has slug + logged-in non-owner → public page", async () => {
    owner = fullOwner({ slug: "alice" });
    currentUser = { id: "someone-else" };
    await expect(call()).rejects.toThrow("permanentRedirect:/gua/alice");
    expect(permanentRedirect).toHaveBeenCalledWith("/gua/alice");
  });

  it("no slug + logged-out → main page", async () => {
    owner = fullOwner({ slug: null });
    currentUser = null;
    await expect(call()).rejects.toThrow("redirect:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("no slug + logged-in non-owner → main page", async () => {
    owner = fullOwner({ slug: null });
    currentUser = { id: "someone-else" };
    await expect(call()).rejects.toThrow("redirect:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("no slug + owner → renders the locked management tab inline (no public URL)", async () => {
    owner = fullOwner({ slug: null });
    currentUser = { id: "u1" };

    const el = (await call()) as { props: Record<string, unknown> };
    const props = el.props;

    expect(redirect).not.toHaveBeenCalled();
    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(props.lockManage).toBe(true);
    expect(props.isOwner).toBe(true);
    expect(props.publicUrl).toBeNull();
    expect(props.displayName).toBe("Alice");
    // private accounts must be loaded (owner view).
    expect(buildAccountGroups).toHaveBeenCalledWith("u1", true);
  });

  it("no slug + owner with no display name → falls back to （未命名）", async () => {
    owner = fullOwner({ slug: null, displayName: null });
    currentUser = { id: "u1" };
    const el = (await call()) as { props: Record<string, unknown> };
    expect(el.props.displayName).toBe("（未命名）");
  });
});
