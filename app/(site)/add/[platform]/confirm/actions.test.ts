import { describe, it, expect, vi, beforeEach } from "vitest";

const findRequestById = vi.fn();
const findLinkedAccount = vi.fn();
const reverifyBinding = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((url: string) => { throw new Error(`redirect:${url}`); });
let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/identity/session", () => ({ getCurrentUser: () => Promise.resolve(currentUser) }));
vi.mock("@/lib/binding/repo", () => ({
  findRequestById: (...a: unknown[]) => findRequestById(...a),
  findLinkedAccount: (...a: unknown[]) => findLinkedAccount(...a),
  reverifyBinding: (...a: unknown[]) => reverifyBinding(...a),
  commitBinding: vi.fn(),
  cancelRequest: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import { recoverAction } from "./actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "u1", slug: "alice", shortRef: "ref1" };
});

describe("recoverAction", () => {
  it("re-verifies the matching account and returns to the 正身 page", async () => {
    findRequestById.mockResolvedValue({ id: "rq1", userId: "u1", platform: "threads", resolvedAccountId: "acc" });
    findLinkedAccount.mockResolvedValue({ id: "la1" });
    reverifyBinding.mockResolvedValue({ ok: true });
    await expect(recoverAction(form({ platform: "threads", rid: "rq1", recover: "acc" }))).rejects.toThrow("redirect:/gua/alice");
    expect(reverifyBinding).toHaveBeenCalledWith({ requestId: "rq1", linkedAccountId: "la1" });
    expect(revalidatePath).toHaveBeenCalledWith("/gua/alice");
  });

  it("bounces back to the recover entry when the resolved author is a different account", async () => {
    findRequestById.mockResolvedValue({ id: "rq1", userId: "u1", platform: "threads", resolvedAccountId: "OTHER" });
    await expect(recoverAction(form({ platform: "threads", rid: "rq1", recover: "acc" }))).rejects.toThrow(
      "redirect:/add/threads/confirm?rid=rq1&recover=acc",
    );
    expect(reverifyBinding).not.toHaveBeenCalled();
  });
});
