import { describe, it, expect, vi, beforeEach } from "vitest";

// Simulate sharp's native module failing to load — exactly the production
// failure on Vercel's linux-x64 runtime (ERR_DLOPEN_FAILED / libvips .so
// missing). The factory throws whenever "sharp" is actually imported.
//
// These tests assert RUNTIME BEHAVIOUR given the lazy-import design: a bio-only
// save completes without ever importing sharp, and an avatar upload degrades
// gracefully if sharp can't load. (The structural guard that sharp is never
// imported at module top level lives in lib/identity/avatar.test.ts — vitest's
// mock factory is lazy, so it cannot catch an *unused* eager import here.)
vi.mock("sharp", () => {
  throw new Error(
    'Could not load the "sharp" module using the linux-x64 runtime (simulated)',
  );
});

const updateUserProfile = vi.fn();
const redirect = vi.fn();
let currentUser: { id: string; shortRef: string } | null = null;

vi.mock("@/lib/identity/session", () => ({
  getCurrentUser: () => Promise.resolve(currentUser),
}));
vi.mock("@/lib/identity/repo", () => ({
  updateUserProfile: (...args: unknown[]) => updateUserProfile(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}));

// Real profile.ts and avatar.ts — we want the actual lazy-import code path.
import { saveProfileAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "user_123", shortRef: "abc123" };
});

function formOf(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("saveProfileAction — sharp unavailable (linux-x64 deploy)", () => {
  it("saves a bio-only profile without loading sharp", async () => {
    // No avatar file at all → sharp must never be imported.
    const result = await saveProfileAction(
      {},
      formOf({ displayName: "阿明", bio: "嗨，我是阿明" }),
    );

    // No errors surfaced, profile persisted, redirected to the 驗明正身 page.
    expect(result).toBeUndefined();
    expect(updateUserProfile).toHaveBeenCalledWith("user_123", {
      displayName: "阿明",
      bio: "嗨，我是阿明",
    });
    expect(redirect).toHaveBeenCalledWith("/r/abc123");
  });

  it("treats an empty avatar field as no avatar (no sharp load)", async () => {
    const result = await saveProfileAction(
      {},
      formOf({
        displayName: "阿明",
        bio: "",
        avatar: new File([], "", { type: "application/octet-stream" }),
      }),
    );

    expect(result).toBeUndefined();
    expect(updateUserProfile).toHaveBeenCalledWith("user_123", {
      displayName: "阿明",
      bio: null,
    });
    expect(redirect).toHaveBeenCalledWith("/r/abc123");
  });

  it("fails gracefully (no crash) when an avatar is uploaded but sharp can't load", async () => {
    const result = await saveProfileAction(
      {},
      formOf({
        displayName: "阿明",
        bio: "",
        avatar: new File([Uint8Array.from([1, 2, 3])], "a.png", { type: "image/png" }),
      }),
    );

    // The DLOPEN failure is caught and returned as a user-facing avatar error,
    // not an unhandled crash — and the profile is NOT half-saved.
    expect(result?.errors?.avatar).toBe("頭像處理失敗，請再試一次");
    expect(updateUserProfile).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
