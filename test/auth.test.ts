import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { authChallenges, authInvites, authSessions, passkeys } from "@/server/db/schema";
import * as auth from "@/server/services/auth";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
import { testDb } from "./db";

const { db, close } = testDb();
afterAll(close);
beforeEach(async () => {
  await db.delete(authSessions);
  await db.delete(authChallenges);
  await db.delete(authInvites);
  await db.delete(passkeys);
});

const rp = auth.relyingParty("https://newb.example.com");

async function addPasskey(id: string) {
  await db.insert(passkeys).values({ id, publicKey: "AA", counter: 0, deviceType: "multiDevice", backedUp: true, name: id });
}

const fakeRegistration = { id: "x", rawId: "x", type: "public-key", response: {}, clientExtensionResults: {} } as unknown as RegistrationResponseJSON;
const fakeAssertion = (id: string) =>
  ({ id, rawId: id, type: "public-key", response: {}, clientExtensionResults: {} }) as unknown as AuthenticationResponseJSON;

describe("APP_ORIGIN", () => {
  it("주소에서 RP ID·origin을 정하고, 없으면 거절한다", () => {
    expect(rp).toEqual({ id: "newb.example.com", origin: "https://newb.example.com", name: "newb" });
    expect(() => auth.relyingParty("")).toThrow(auth.AuthError);
  });
});

describe("초대", () => {
  it("로그인하지 않았으면 유효한 초대가 있어야 등록을 시작할 수 있다", async () => {
    await expect(auth.startRegistration(db, rp, { signedIn: false })).rejects.toThrow("초대 링크");
    await expect(auth.startRegistration(db, rp, { signedIn: false, invite: "nope" })).rejects.toThrow("초대 링크");

    const token = await auth.createInvite(db);
    const started = await auth.startRegistration(db, rp, { signedIn: false, invite: token });
    expect(started.options.rp).toEqual({ id: "newb.example.com", name: "newb" });
    expect(started.options.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });

    // 로그인한 상태(기기 추가)면 초대 없이도
    await expect(auth.startRegistration(db, rp, { signedIn: true })).resolves.toBeTruthy();
  });

  it("DB에는 토큰 원문이 아니라 해시만 남는다", async () => {
    const token = await auth.createInvite(db);
    const rows = await db.select().from(authInvites);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toContain(token);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("만료된 초대는 쓸 수 없다", async () => {
    const token = await auth.createInvite(db);
    await db.update(authInvites).set({ expiresAt: sql`CURRENT_TIMESTAMP(3) - INTERVAL 1 MINUTE` });
    await expect(auth.startRegistration(db, rp, { signedIn: false, invite: token })).rejects.toThrow("초대 링크");
  });

  it("이미 등록된 Passkey는 같은 기기에 다시 만들지 않도록 제외 목록에 넣는다", async () => {
    await addPasskey("pk-a");
    const started = await auth.startRegistration(db, rp, { signedIn: true });
    expect(started.options.excludeCredentials?.map((c) => c.id)).toEqual(["pk-a"]);
  });

  it("초대가 무효면 도전값을 쓰기 전에 거절한다", async () => {
    const token = await auth.createInvite(db);
    const { challengeId } = await auth.startRegistration(db, rp, { signedIn: false, invite: token });
    await expect(
      auth.finishRegistration(db, rp, { challengeId, response: fakeRegistration, signedIn: false, invite: "other", deviceName: "Mac" }),
    ).rejects.toThrow("초대 링크");
    expect(await db.select().from(authChallenges).where(eq(authChallenges.id, challengeId))).toHaveLength(1);
  });

  it("검증에 실패한 응답으로는 등록되지 않고 초대도 그대로 남는다", async () => {
    const token = await auth.createInvite(db);
    const { challengeId } = await auth.startRegistration(db, rp, { signedIn: false, invite: token });
    await expect(
      auth.finishRegistration(db, rp, { challengeId, response: fakeRegistration, signedIn: false, invite: token, deviceName: "Mac" }),
    ).rejects.toThrow("확인하지 못했어요");
    expect(await auth.passkeyCount(db)).toBe(0);
    const [invite] = await db.select().from(authInvites);
    expect(invite.usedAt).toBeNull();
  });
});

describe("도전값", () => {
  it("한 번만 쓸 수 있다 (두 번째는 시간이 지난 것으로)", async () => {
    const { challengeId } = await auth.startLogin(db, rp);
    await expect(auth.finishLogin(db, rp, { challengeId, response: fakeAssertion("unknown") })).rejects.toThrow("등록되지 않은");
    await expect(auth.finishLogin(db, rp, { challengeId, response: fakeAssertion("unknown") })).rejects.toThrow("시간이 지났어요");
  });

  it("등록용 도전값으로 로그인할 수 없다", async () => {
    const { challengeId } = await auth.startRegistration(db, rp, { signedIn: true });
    await expect(auth.finishLogin(db, rp, { challengeId, response: fakeAssertion("x") })).rejects.toThrow("시간이 지났어요");
  });

  it("만료된 도전값은 쓸 수 없다", async () => {
    const { challengeId } = await auth.startLogin(db, rp);
    await db.update(authChallenges).set({ expiresAt: sql`CURRENT_TIMESTAMP(3) - INTERVAL 1 SECOND` });
    await expect(auth.finishLogin(db, rp, { challengeId, response: fakeAssertion("x") })).rejects.toThrow("시간이 지났어요");
  });

  it("살아 있는 도전값이 너무 많으면 새로 만들지 않는다", async () => {
    await db.insert(authChallenges).values(
      Array.from({ length: 100 }, (_, i) => ({
        id: i.toString(16).padStart(32, "0"),
        challenge: "c",
        purpose: "login" as const,
        expiresAt: sql`CURRENT_TIMESTAMP(3) + INTERVAL 5 MINUTE`,
      })),
    );
    await expect(auth.startLogin(db, rp)).rejects.toThrow("요청이 너무 많아요");
    // 만료된 것은 새로 만들 때 정리된다
    await db.update(authChallenges).set({ expiresAt: sql`CURRENT_TIMESTAMP(3) - INTERVAL 1 SECOND` });
    await expect(auth.startLogin(db, rp)).resolves.toBeTruthy();
    expect(await db.select().from(authChallenges)).toHaveLength(1);
  });
});

describe("세션", () => {
  it("만들고 → 확인하고 → 지운다. DB에는 해시만", async () => {
    await addPasskey("pk-a");
    const token = await auth.createSession(db, "pk-a");
    expect(await auth.sessionPasskey(db, token)).toBe("pk-a");
    const [row] = await db.select().from(authSessions);
    expect(row.idHash).not.toContain(token);

    await auth.deleteSession(db, token);
    expect(await auth.sessionPasskey(db, token)).toBeNull();
  });

  it("만료됐거나 모르는 값이면 로그인이 아니다", async () => {
    await addPasskey("pk-a");
    const token = await auth.createSession(db, "pk-a");
    await db.update(authSessions).set({ expiresAt: sql`CURRENT_TIMESTAMP(3) - INTERVAL 1 SECOND` });
    expect(await auth.sessionPasskey(db, token)).toBeNull();
    expect(await auth.sessionPasskey(db, undefined)).toBeNull();
    expect(await auth.sessionPasskey(db, "x".repeat(500))).toBeNull();
  });
});

describe("Passkey 관리", () => {
  it("지금 로그인에 쓴 것과 마지막 하나는 지울 수 없다", async () => {
    await addPasskey("pk-a");
    await expect(auth.deletePasskey(db, "pk-a", null)).rejects.toThrow("마지막");
    await addPasskey("pk-b");
    await expect(auth.deletePasskey(db, "pk-a", "pk-a")).rejects.toThrow("지금 이 로그인");
  });

  it("지우면 그 Passkey로 연 세션도 끝난다", async () => {
    await addPasskey("pk-a");
    await addPasskey("pk-b");
    const tokenB = await auth.createSession(db, "pk-b");
    await auth.deletePasskey(db, "pk-b", "pk-a");
    expect(await auth.sessionPasskey(db, tokenB)).toBeNull();
    expect((await auth.listPasskeys(db)).map((p) => p.id)).toEqual(["pk-a"]);
  });

  it("User-Agent로 기기 이름을 붙인다", () => {
    expect(auth.deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iPhone");
    expect(auth.deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
    expect(auth.deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("Mac");
    expect(auth.deviceName(null)).toBe("기기");
  });
});
