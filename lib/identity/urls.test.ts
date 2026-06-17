import { describe, it, expect } from "vitest";
import { ownerHomePath } from "./urls";

describe("ownerHomePath", () => {
  it("slug exists → public card", () => {
    expect(ownerHomePath({ slug: "alice", shortRef: "x9" })).toBe("/gua/alice");
  });

  it("no slug → short link (always resolvable)", () => {
    expect(ownerHomePath({ slug: null, shortRef: "x9" })).toBe("/r/x9");
  });
});
