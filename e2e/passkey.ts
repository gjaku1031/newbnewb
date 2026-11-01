import type { Page } from "@playwright/test";

/**
 * Chrome 가상 인증기 — Face ID·지문 대신 자동으로 본인 확인까지 통과한다.
 * 페이지(CDP 세션)마다 따로라서, 여기서 만든 Passkey는 이 페이지에서만 쓸 수 있다.
 */
export async function addVirtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}
