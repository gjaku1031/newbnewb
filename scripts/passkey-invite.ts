// Passkey 등록용 1회 초대 링크 만들기 (첫 Passkey, 또는 로그인할 기기가 하나도 없을 때)
// 운영: ssh -t oci-prod 'docker exec newb-app-1 node passkey-invite.cjs'
// 로컬: npm run auth:invite
// 링크는 비밀번호처럼 다룬다 — 만든 사람만 보고, 바로 연 뒤 버린다 (한 번 쓰면 끝, 30분 뒤 만료)
import { getDb, getPool } from "@/server/db/client";
import { createInvite, passkeyCount, relyingParty } from "@/server/services/auth";

async function main() {
  const minutes = Number(process.env.INVITE_MINUTES ?? 30);
  const rp = relyingParty();
  const db = getDb();
  const existing = await passkeyCount(db);
  const token = await createInvite(db, minutes);
  if (process.argv.includes("--token-only")) {
    process.stdout.write(token);
  } else {
    if (existing > 0) console.log(`이미 등록된 Passkey ${existing}개가 있어요. 이 링크로 하나를 더 만들어요.`);
    console.log(`\n이 링크를 Passkey를 만들 기기에서 여세요 (${minutes}분 안에, 한 번만):\n\n  ${rp.origin}/?invite=${token}\n`);
  }
  await getPool().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
