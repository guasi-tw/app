import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  buildCreateUserInput,
  isShortRefCollision,
  createUserWithRetry,
} from "./adapter";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo.Bar@Example.COM ")).toBe("foo.bar@example.com");
  });
});

describe("buildCreateUserInput", () => {
  it("normalizes the email, seeds profile, and attaches the shortRef", () => {
    const out = buildCreateUserInput(
      { email: " Alice@Example.com ", name: "Alice Wang", image: "https://x/a" },
      "ABC123xyz0",
    );
    expect(out.email).toBe("alice@example.com");
    expect(out.displayName).toBe("Alice Wang");
    expect(out.avatarUrl).toBe("https://x/a");
    expect(out.shortRef).toBe("ABC123xyz0");
  });

  it("leaves a missing email untouched and seeds nulls", () => {
    const out = buildCreateUserInput({ email: null, name: null, image: null }, "ref0000000");
    expect(out.email).toBeNull();
    expect(out.displayName).toBeNull();
    expect(out.avatarUrl).toBeNull();
    expect(out.shortRef).toBe("ref0000000");
  });
});

describe("isShortRefCollision", () => {
  it("is true for a P2002 on the shortRef target", () => {
    expect(isShortRefCollision({ code: "P2002", meta: { target: ["shortRef"] } })).toBe(true);
  });
  it("is false for a P2002 on another column (e.g. email)", () => {
    expect(isShortRefCollision({ code: "P2002", meta: { target: ["email"] } })).toBe(false);
  });
  it("is false for non-P2002 / non-error values", () => {
    expect(isShortRefCollision({ code: "P2025" })).toBe(false);
    expect(isShortRefCollision(null)).toBe(false);
  });
});

describe("createUserWithRetry", () => {
  it("regenerates the shortRef and retries on a shortRef collision", async () => {
    const refs: string[] = [];
    let calls = 0;
    const insert = async (input: { shortRef: string }) => {
      calls++;
      refs.push(input.shortRef);
      if (calls === 1) throw { code: "P2002", meta: { target: ["shortRef"] } };
      return input as never;
    };
    let seq = 0;
    const out = await createUserWithRetry(insert, { email: "a@b.com" } as never, () => `ref${seq++}`);
    expect(calls).toBe(2);
    expect(refs).toEqual(["ref0", "ref1"]); // a fresh ref on the retry
    expect((out as { shortRef: string }).shortRef).toBe("ref1");
  });

  it("rethrows a non-shortRef unique violation immediately (no retry)", async () => {
    let calls = 0;
    const insert = async () => {
      calls++;
      throw { code: "P2002", meta: { target: ["email"] } };
    };
    await expect(
      createUserWithRetry(insert, { email: "a@b.com" } as never, () => "ref"),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(calls).toBe(1);
  });
});
