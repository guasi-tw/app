import { describe, it, expect } from "vitest";
import { landingCtaModel } from "./landing-cta-model";

describe("landingCtaModel", () => {
  it("logged-out → sign-in CTA", () => {
    expect(landingCtaModel(null)).toEqual({ kind: "signin" });
  });

  it("logged-in with a slug → link to the public card", () => {
    expect(landingCtaModel({ slug: "meimei", shortRef: "abc" })).toEqual({
      kind: "home",
      href: "/gua/meimei",
    });
  });

  it("logged-in without a slug → link to the short ref", () => {
    expect(landingCtaModel({ slug: null, shortRef: "abc" })).toEqual({
      kind: "home",
      href: "/r/abc",
    });
  });
});
