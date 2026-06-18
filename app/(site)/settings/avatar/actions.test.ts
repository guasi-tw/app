import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sharp", () => {
  throw new Error('Could not load the "sharp" module using the linux-x64 runtime (simulated)');
});

const updateUserAvatar = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn();
let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/identity/session", () => ({ getCurrentUser: () => Promise.resolve(currentUser) }));
vi.mock("@/lib/identity/repo", () => ({ updateUserAvatar: (...a: unknown[]) => updateUserAvatar(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirect(...a) }));

import { saveAvatarAction } from "./actions";

function form(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "user_123", slug: "alice", shortRef: "ref1" };
});

describe("saveAvatarAction", () => {
  it("rejects a submission with no file (never touches storage)", async () => {
    const result = await saveAvatarAction({}, form({ avatar: new File([], "", { type: "application/octet-stream" }) }));
    expect(result?.error).toBe("請選擇圖片");
    expect(updateUserAvatar).not.toHaveBeenCalled();
  });

  it("degrades gracefully when sharp can't load (no crash, profile untouched)", async () => {
    const result = await saveAvatarAction(
      {},
      form({ avatar: new File([Uint8Array.from([1, 2, 3])], "a.png", { type: "image/png" }) }),
    );
    expect(result?.error).toBe("頭像處理失敗，請再試一次");
    expect(updateUserAvatar).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
