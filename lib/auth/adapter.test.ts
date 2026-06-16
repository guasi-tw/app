import { describe, it, expect } from "vitest";
import { normalizeEmail, buildCreateUserInput } from "./adapter";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo.Bar@Example.COM ")).toBe("foo.bar@example.com");
  });
});

describe("buildCreateUserInput", () => {
  it("normalizes the email and seeds displayName/avatarUrl from name/image", () => {
    const out = buildCreateUserInput({
      email: " Alice@Example.com ",
      name: "Alice Wang",
      image: "https://lh3.googleusercontent.com/a/abc",
    });
    expect(out.email).toBe("alice@example.com");
    expect(out.displayName).toBe("Alice Wang");
    expect(out.avatarUrl).toBe("https://lh3.googleusercontent.com/a/abc");
  });

  it("leaves a missing email untouched and seeds nulls for missing name/image", () => {
    const out = buildCreateUserInput({ email: null, name: null, image: null });
    expect(out.email).toBeNull();
    expect(out.displayName).toBeNull();
    expect(out.avatarUrl).toBeNull();
  });

  it("preserves other fields passed by the adapter", () => {
    const out = buildCreateUserInput({ email: "a@b.com", emailVerified: null, extra: 1 } as never);
    expect((out as { extra: number }).extra).toBe(1);
  });
});
