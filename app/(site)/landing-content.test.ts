import { describe, it, expect } from "vitest";
import { landingContent } from "./landing-content";

const blob = JSON.stringify(landingContent);

describe("landingContent — accuracy constraints", () => {
  it("lists exactly the three MVP platforms plus a 'more' chip", () => {
    expect(landingContent.platforms.items).toEqual([
      "Threads",
      "Instagram",
      "miin.cc",
    ]);
    expect(landingContent.platforms.more).toContain("更多");
  });

  it("makes no Email / magic-link login claim (Google-only today)", () => {
    // The support contact (support@guasi.tw) is a help address, not a login
    // method — exclude it so it doesn't trip the email-login guard.
    const { contact: _contact, ...loginRelevant } = landingContent;
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
    expect(landingContent.how.steps.map((s) => s.title)).toEqual([
      "建立正身",
      "綁定分身",
      "驗明正身",
    ]);
  });

  it("numbers the steps 1, 2, 3 in order", () => {
    expect(landingContent.how.steps.map((s) => s.n)).toEqual([1, 2, 3]);
  });

  it("has three trust points", () => {
    expect(landingContent.trust.items).toHaveLength(3);
  });

  it("states platform independence — neutral, no API/authorization needed", () => {
    expect(landingContent.independence.title).toContain("不綁");
    expect(landingContent.independence.body).toContain("公開貼文");
    expect(landingContent.independence.body).toContain("授權");
  });

  it("example card states the same-owner guarantee, verified by public post", () => {
    expect(landingContent.exampleProfile.guarantee).toContain("同一人");
    expect(landingContent.exampleProfile.guarantee).toContain("公開貼文");
  });

  it("frames the public page as a shareable cross-platform profile link", () => {
    // The /gua/{slug} link is the user's shareable public profile, posted on
    // other platforms so followers can confirm cross-platform ownership.
    expect(landingContent.exampleProfile.sectionDesc).toContain("guasi.tw/gua/");
    expect(landingContent.exampleProfile.sectionDesc).toContain("連結");
    expect(landingContent.exampleProfile.shareCaption).toContain("各平台");
  });
});

describe("landingContent — key anchor copy", () => {
  it("keeps the universal hook line", () => {
    expect(landingContent.hook.title).toContain("這真的是我");
  });

  it("leads the brand as guasi", () => {
    expect(landingContent.brand.wordmark).toBe("guasi");
  });

  it("introduces 正身 with its romanization only (no 本尊 gloss)", () => {
    expect(blob).toContain("(tsiànn-sin)");
    // Only the 正身 gloss must avoid 本尊. The hook body intentionally quotes a
    // scammer's voice (「本尊回來了」) — that use is narrative, not definitional.
    expect(landingContent.how.gloss).not.toContain("本尊");
  });
});
