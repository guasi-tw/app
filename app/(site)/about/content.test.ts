import { describe, it, expect } from "vitest";
import { aboutContent } from "./content";

const blob = JSON.stringify(aboutContent);

describe("aboutContent — accuracy constraints", () => {
  it("CTA points to the login route", () => {
    expect(aboutContent.cta.href).toBe("/login");
  });

  it("CTA names Google as the login method", () => {
    expect(aboutContent.cta.buttonLabel).toContain("Google");
  });

  it("lists exactly the three MVP platforms plus a 'more' chip", () => {
    expect(aboutContent.platforms.items).toEqual([
      "Threads",
      "Instagram",
      "miin.cc",
    ]);
    expect(aboutContent.platforms.more).toContain("更多");
  });

  it("makes no Email / magic-link login claim (Google-only today)", () => {
    // The support contact (support@guasi.tw) is a help address, not a login
    // method — exclude it so it doesn't trip the email-login guard.
    const { contact: _contact, ...loginRelevant } = aboutContent;
    const loginBlob = JSON.stringify(loginRelevant);
    expect(loginBlob).not.toMatch(/email/i);
    expect(loginBlob).not.toContain("magic");
  });

  it("makes no snapshot / screenshot durability claim (link-only today)", () => {
    expect(blob).not.toContain("截圖");
    expect(blob).not.toContain("快照");
    expect(blob).not.toMatch(/snapshot/i);
  });

  it("has three how-it-works steps in order", () => {
    expect(aboutContent.how.steps.map((s) => s.title)).toEqual([
      "建立正身",
      "註冊分身",
      "驗明正身",
    ]);
  });

  it("numbers the steps 1, 2, 3 in order", () => {
    expect(aboutContent.how.steps.map((s) => s.n)).toEqual([1, 2, 3]);
  });

  it("has three trust points", () => {
    expect(aboutContent.trust.items).toHaveLength(3);
  });

  it("states platform independence — neutral, no API/authorization needed", () => {
    expect(aboutContent.independence.title).toContain("不綁");
    expect(aboutContent.independence.body).toContain("公開貼文");
    expect(aboutContent.independence.body).toContain("授權");
  });

  it("example card states the same-owner guarantee, verified by public post", () => {
    expect(aboutContent.exampleProfile.guarantee).toContain("同一人");
    expect(aboutContent.exampleProfile.guarantee).toContain("公開貼文");
  });

  it("frames the public page as a shareable cross-platform profile link", () => {
    // The /gua/{slug} link is the user's shareable public profile, posted on
    // other platforms so followers can confirm cross-platform ownership.
    expect(aboutContent.exampleProfile.sectionDesc).toContain("guasi.tw/gua/");
    expect(aboutContent.exampleProfile.sectionDesc).toContain("連結");
    expect(aboutContent.exampleProfile.shareCaption).toContain("各平台");
  });
});

describe("aboutContent — key anchor copy", () => {
  it("keeps the universal hook line", () => {
    expect(aboutContent.hook.title).toContain("這真的是我");
  });

  it("leads the brand as guasi", () => {
    expect(aboutContent.brand.wordmark).toBe("guasi");
  });

  it("introduces 正身 with its romanization only (no 本尊 gloss)", () => {
    expect(blob).toContain("(tsiànn-sin)");
    // Only the 正身 gloss must avoid 本尊. The hook body intentionally quotes a
    // scammer's voice (「本尊回來了」) — that use is narrative, not definitional.
    expect(aboutContent.how.gloss).not.toContain("本尊");
  });
});
