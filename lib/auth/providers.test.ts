import { describe, it, expect } from "vitest";
import { providers } from "./providers";

describe("auth providers", () => {
  it("forces Google's account chooser with prompt=select_account", () => {
    // Google is the only provider in the MVP. next-auth v5 normalizes the user-supplied
    // provider config under `.options`, so the authorization params live there.
    const google = providers[0] as {
      options?: { authorization?: { params?: Record<string, string> } };
    };
    expect(google.options?.authorization?.params?.prompt).toBe("select_account");
  });
});
