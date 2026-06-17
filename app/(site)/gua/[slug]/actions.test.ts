import { describe, it, expect, vi, beforeEach } from "vitest";

const discloseBinding = vi.fn();
const setMainBinding = vi.fn();
const reportCondition = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn();
let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/binding/repo", () => ({
  discloseBinding: (...a: unknown[]) => discloseBinding(...a),
  setMainBinding: (...a: unknown[]) => setMainBinding(...a),
  reportCondition: (...a: unknown[]) => reportCondition(...a),
}));
vi.mock("@/lib/identity/session", () => ({ getCurrentUser: () => Promise.resolve(currentUser) }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirect(...a) }));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));

import { discloseAction, setMainAction, reportConditionAction } from "./actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "u1", slug: "alice", shortRef: "ref1" };
});

describe("manage actions", () => {
  it("discloseAction calls discloseBinding + revalidates the owner's pages", async () => {
    await discloseAction(form({ linkedAccountId: "la1" }));
    expect(discloseBinding).toHaveBeenCalledWith("u1", "la1");
    expect(revalidatePath).toHaveBeenCalledWith("/gua/alice");
    expect(revalidatePath).toHaveBeenCalledWith("/r/ref1");
  });

  it("setMainAction calls setMainBinding", async () => {
    await setMainAction(form({ linkedAccountId: "la2" }));
    expect(setMainBinding).toHaveBeenCalledWith("u1", "la2");
  });

  it("reportConditionAction passes a valid condition through", async () => {
    await reportConditionAction(form({ linkedAccountId: "la3", condition: "hacked" }));
    expect(reportCondition).toHaveBeenCalledWith("u1", "la3", "hacked");
  });

  it("reportConditionAction redirects home on an invalid condition (never calls repo)", async () => {
    await reportConditionAction(form({ linkedAccountId: "la3", condition: "bogus" }));
    expect(reportCondition).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("a logged-out caller is sent to /login", async () => {
    currentUser = null;
    await discloseAction(form({ linkedAccountId: "la1" }));
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(discloseBinding).not.toHaveBeenCalled();
  });
});
