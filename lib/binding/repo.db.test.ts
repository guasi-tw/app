// lib/binding/repo.db.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  createBindingRequest,
  findActiveRequest,
  findLinkedAccount,
  markResolved,
  cancelRequest,
  commitBinding,
  discloseBinding,
  setMainBinding,
  reportCondition,
  reverifyBinding,
} from "./repo";

const hasDb = !!process.env.DATABASE_URL;
const userIds: string[] = [];

async function freshUser(email: string, shortRef: string) {
  const u = await prisma.user.create({ data: { email, shortRef } });
  userIds.push(u.id);
  return u;
}

async function resolvedRequest(userId: string, handle: string, code = "012345") {
  const req = await createBindingRequest({ userId, platform: "threads", code });
  return markResolved(req.id, {
    resolvedAccountId: handle,
    resolvedHandle: handle,
    resolvedDisplayName: "Disp",
    proofPostUrl: "https://www.threads.net/@x/post/ABC",
  });
}

afterAll(async () => {
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!hasDb)("binding repo (DB)", () => {
  it("createBindingRequest is pending + findActiveRequest reuses it", async () => {
    const u = await freshUser("br-active@example.com", "BrActive01");
    const req = await createBindingRequest({ userId: u.id, platform: "threads", code: "000111" });
    expect(req.status).toBe("pending");
    expect((await findActiveRequest(u.id, "threads"))?.id).toBe(req.id);
  });

  it("commitBinding on a still-pending (unresolved) request returns not_resolvable", async () => {
    const u = await freshUser("br-unres@example.com", "BrUnres01");
    const req = await createBindingRequest({ userId: u.id, platform: "threads", code: "222333" });
    const res = await commitBinding({ requestId: req.id, asMain: false, visibility: "private", mintSlug: false });
    expect(res).toEqual({ ok: false, error: "not_resolvable" });
    expect(await prisma.linkedAccount.count({ where: { userId: u.id } })).toBe(0);
  });

  it("commitBinding (ordinary, non-main) writes LinkedAccount + ProofRecord + bound event, no slug", async () => {
    const u = await freshUser("br-ord@example.com", "BrOrd0001");
    const req = await resolvedRequest(u.id, "ordhandle");
    const res = await commitBinding({ requestId: req.id, asMain: false, visibility: "private", mintSlug: false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.slug).toBeNull();
    const la = await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } });
    expect(la?.isMain).toBe(false);
    expect(la?.visibility).toBe("private");
    expect(await prisma.proofRecord.count({ where: { linkedAccountId: res.linkedAccountId } })).toBe(1);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "bound" } })).toBe(1);
    expect((await prisma.bindingRequest.findUnique({ where: { id: req.id } }))?.status).toBe("verified");
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.slug).toBeNull();
  });

  it("commitBinding (confirm-as-slug) mints the slug + forces isMain/public", async () => {
    const u = await freshUser("br-slug@example.com", "BrSlug001");
    const req = await resolvedRequest(u.id, "MintMe");
    const res = await commitBinding({ requestId: req.id, asMain: true, visibility: "private", mintSlug: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.slug).toBe("MintMe");
    const la = await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } });
    expect(la?.isMain).toBe(true);
    expect(la?.visibility).toBe("public"); // forced despite visibility:"private"
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.slug).toBe("MintMe");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "set_main" } })).toBe(1);
  });

  it("commitBinding (ordinary, non-main) writes no set_main event", async () => {
    const u = await freshUser("br-nomain@example.com", "BrNoMain0");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "plainrow")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(res.ok).toBe(true);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "set_main" } })).toBe(0);
  });

  it("commitBinding returns slug_taken on a case-insensitive slug clash (first-claim-wins)", async () => {
    const u1 = await freshUser("br-race1@example.com", "BrRace001");
    await commitBinding({ requestId: (await resolvedRequest(u1.id, "RaceName")).id, asMain: true, visibility: "private", mintSlug: true });
    const u2 = await freshUser("br-race2@example.com", "BrRace002");
    const res = await commitBinding({ requestId: (await resolvedRequest(u2.id, "racename")).id, asMain: true, visibility: "private", mintSlug: true });
    expect(res).toEqual({ ok: false, error: "slug_taken" });
    expect((await prisma.user.findUnique({ where: { id: u2.id } }))?.slug).toBeNull(); // txn rolled back
  });

  it("commitBinding returns duplicate_binding when the same account is bound twice by one 正身 (§A.6)", async () => {
    const u = await freshUser("br-dup@example.com", "BrDup0001");
    await commitBinding({ requestId: (await resolvedRequest(u.id, "dupacct")).id, asMain: false, visibility: "private", mintSlug: false });
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "dupacct")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(res).toEqual({ ok: false, error: "duplicate_binding" });
  });

  it("the SAME account may be bound by TWO different 正身 (no global lock, §A.6)", async () => {
    const a = await freshUser("br-shareA@example.com", "BrShareA0");
    const b = await freshUser("br-shareB@example.com", "BrShareB0");
    const ra = await commitBinding({ requestId: (await resolvedRequest(a.id, "shared")).id, asMain: false, visibility: "private", mintSlug: false });
    const rb = await commitBinding({ requestId: (await resolvedRequest(b.id, "shared")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(ra.ok && rb.ok).toBe(true);
  });

  it("cancelRequest commits nothing", async () => {
    const u = await freshUser("br-cancel@example.com", "BrCancel0");
    const req = await resolvedRequest(u.id, "cancelme");
    await cancelRequest(req.id);
    expect((await prisma.bindingRequest.findUnique({ where: { id: req.id } }))?.status).toBe("cancelled");
    expect(await prisma.linkedAccount.count({ where: { userId: u.id } })).toBe(0);
  });

  it("findLinkedAccount detects a re-validate (already-bound) and is null otherwise (§A.6)", async () => {
    const u = await freshUser("br-rebind@example.com", "BrRebind0");
    await commitBinding({ requestId: (await resolvedRequest(u.id, "boundacct")).id, asMain: false, visibility: "private", mintSlug: false });
    expect((await findLinkedAccount(u.id, "threads", "boundacct"))?.handle).toBe("boundacct");
    expect(await findLinkedAccount(u.id, "threads", "neveracct")).toBeNull();
  });

  it("discloseBinding flips a private row to public + writes a disclosed event (idempotent)", async () => {
    const u = await freshUser("br-disc@example.com", "BrDisc001");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "discme")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ok = await discloseBinding(u.id, res.linkedAccountId);
    expect(ok).toEqual({ ok: true });
    expect((await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } }))?.visibility).toBe("public");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "disclosed" } })).toBe(1);

    // Idempotent: disclosing an already-public row writes no second event.
    await discloseBinding(u.id, res.linkedAccountId);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "disclosed" } })).toBe(1);
  });

  it("discloseBinding rejects an account owned by someone else", async () => {
    const owner = await freshUser("br-disc-own@example.com", "BrDiscOwn");
    const other = await freshUser("br-disc-oth@example.com", "BrDiscOth");
    const res = await commitBinding({ requestId: (await resolvedRequest(owner.id, "ownonly")).id, asMain: false, visibility: "private", mintSlug: false });
    if (!res.ok) return;
    expect(await discloseBinding(other.id, res.linkedAccountId)).toEqual({ ok: false, error: "not_found" });
  });

  it("setMainBinding re-points the ★ to a public row, clearing the old main, writing only set_main", async () => {
    const u = await freshUser("br-main1@example.com", "BrMain001");
    const first = await commitBinding({ requestId: (await resolvedRequest(u.id, "firstmain")).id, asMain: true, visibility: "public", mintSlug: true });
    const second = await commitBinding({ requestId: (await resolvedRequest(u.id, "second")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!first.ok || !second.ok) return;

    const ok = await setMainBinding(u.id, second.linkedAccountId);
    expect(ok).toEqual({ ok: true });
    expect((await prisma.linkedAccount.findUnique({ where: { id: first.linkedAccountId } }))?.isMain).toBe(false);
    const newMain = await prisma.linkedAccount.findUnique({ where: { id: second.linkedAccountId } });
    expect(newMain?.isMain).toBe(true);
    expect(newMain?.visibility).toBe("public"); // old main stays public (permanence)
    expect((await prisma.linkedAccount.findUnique({ where: { id: first.linkedAccountId } }))?.visibility).toBe("public");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "set_main", accountId: "second" } })).toBe(1);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "disclosed" } })).toBe(0); // was already public
  });

  it("setMainBinding on a PRIVATE row forces it public + writes both disclosed and set_main", async () => {
    const u = await freshUser("br-main2@example.com", "BrMain002");
    await commitBinding({ requestId: (await resolvedRequest(u.id, "rootmain")).id, asMain: true, visibility: "public", mintSlug: true });
    const priv = await commitBinding({ requestId: (await resolvedRequest(u.id, "privrow")).id, asMain: false, visibility: "private", mintSlug: false });
    if (!priv.ok) return;

    await setMainBinding(u.id, priv.linkedAccountId);
    const row = await prisma.linkedAccount.findUnique({ where: { id: priv.linkedAccountId } });
    expect(row?.isMain).toBe(true);
    expect(row?.visibility).toBe("public");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "disclosed", accountId: "privrow" } })).toBe(1);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "set_main", accountId: "privrow" } })).toBe(1);
  });

  it("setMainBinding refuses a flagged (non-active) account", async () => {
    const u = await freshUser("br-main3@example.com", "BrMain003");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "flagme")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!res.ok) return;
    await prisma.linkedAccount.update({ where: { id: res.linkedAccountId }, data: { condition: "hacked" } });
    expect(await setMainBinding(u.id, res.linkedAccountId)).toEqual({ ok: false, error: "not_active" });
  });

  it("reportCondition('hacked') flags the row + writes reported_hacked; ('banned') → reported_banned", async () => {
    const u = await freshUser("br-cond@example.com", "BrCond001");
    const h = await commitBinding({ requestId: (await resolvedRequest(u.id, "hackedone")).id, asMain: false, visibility: "public", mintSlug: false });
    const b = await commitBinding({ requestId: (await resolvedRequest(u.id, "bannedone")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!h.ok || !b.ok) return;

    expect(await reportCondition(u.id, h.linkedAccountId, "hacked")).toEqual({ ok: true });
    expect((await prisma.linkedAccount.findUnique({ where: { id: h.linkedAccountId } }))?.condition).toBe("hacked");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "reported_hacked", accountId: "hackedone" } })).toBe(1);

    expect(await reportCondition(u.id, b.linkedAccountId, "banned")).toEqual({ ok: true });
    expect((await prisma.linkedAccount.findUnique({ where: { id: b.linkedAccountId } }))?.condition).toBe("banned");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "reported_banned", accountId: "bannedone" } })).toBe(1);
  });

  it("reportCondition rejects an account the caller does not own", async () => {
    const owner = await freshUser("br-cond-own@example.com", "BrCondOwn");
    const other = await freshUser("br-cond-oth@example.com", "BrCondOth");
    const res = await commitBinding({ requestId: (await resolvedRequest(owner.id, "mineonly")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!res.ok) return;
    expect(await reportCondition(other.id, res.linkedAccountId, "hacked")).toEqual({ ok: false, error: "not_found" });
  });

  it("reverifyBinding refreshes a flagged row: new ProofRecord + re_verified, restores active, keeps one row", async () => {
    const u = await freshUser("br-rev@example.com", "BrRev0001");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "revacct")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!res.ok) return;
    await prisma.linkedAccount.update({ where: { id: res.linkedAccountId }, data: { condition: "hacked" } });

    // A fresh resolved request from the SAME account (accountId === handle for Threads).
    const fresh = await resolvedRequest(u.id, "revacct");
    const out = await reverifyBinding({ requestId: fresh.id, linkedAccountId: res.linkedAccountId });
    expect(out).toEqual({ ok: true });

    const row = await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } });
    expect(row?.condition).toBe("active");
    expect(await prisma.linkedAccount.count({ where: { userId: u.id, accountId: "revacct" } })).toBe(1); // never a dup row
    expect(await prisma.proofRecord.count({ where: { linkedAccountId: res.linkedAccountId } })).toBe(2); // original + refresh
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "re_verified" } })).toBe(1);
    expect((await prisma.bindingRequest.findUnique({ where: { id: fresh.id } }))?.status).toBe("verified");
  });

  it("reverifyBinding rejects when the resolved author is a different account", async () => {
    const u = await freshUser("br-rev2@example.com", "BrRev0002");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "realacct")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!res.ok) return;
    const wrong = await resolvedRequest(u.id, "wrongacct"); // different resolvedAccountId
    expect(await reverifyBinding({ requestId: wrong.id, linkedAccountId: res.linkedAccountId })).toEqual({ ok: false, error: "account_mismatch" });
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "re_verified" } })).toBe(0);
  });

});
