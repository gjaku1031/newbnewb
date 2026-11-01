import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { Database, Download, KeyRound } from "lucide-react";
import { Button } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/server/db/client";
import { sources } from "@/server/db/schema";
import { listPasskeys } from "@/server/services/auth";
import { Row, SettingsSection } from "./Section";
import { PasskeyControls, type PasskeyRow } from "./PasskeyControls";

/** 한국 시간 "YYYY-MM-DD HH:mm" (DB 기록 시각은 UTC) */
function kst(utc: string | null) {
  if (!utc) return null;
  const d = new Date(utc.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** 등록한 Passkey 목록·기기 추가·로그아웃 (로그인했을 때만) */
export async function AccountSettings() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;
  const rows: PasskeyRow[] = (await listPasskeys(getDb())).map((p) => ({
    id: p.id,
    name: p.name,
    added: kst(p.createdAt)!.slice(0, 10),
    lastUsed: kst(p.lastUsedAt),
    synced: p.backedUp,
    current: p.id === user.passkeyId,
  }));
  return (
    <SettingsSection
      id="account"
      title="로그인"
      description="iCloud 키체인·Google 비밀번호 관리자에 저장된 Passkey는 같은 계정의 다른 기기에서도 쓸 수 있어요. 다른 기기라면 로그인 창에서 휴대폰(QR)으로 로그인한 뒤 여기서 그 기기를 추가하세요."
      icon={<KeyRound className="size-4" />}
    >
      <PasskeyControls rows={rows} />
    </SettingsSection>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

/** 올린 원본 문서 수·용량 (DB 기준). 로그인하지 않았으면 보여주지 않는다 */
export async function DataSettings() {
  await connection();
  const user = await getCurrentUser();
  let usage = "—";
  if (user) {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)`, bytes: sql<string | null>`sum(${sources.sizeBytes})` })
      .from(sources);
    const count = Number(row?.count ?? 0);
    usage = count === 0 ? "아직 없어요" : `${count}개 · ${formatBytes(Number(row?.bytes ?? 0))}`;
  }
  return (
    <SettingsSection id="data" title="데이터" icon={<Database className="size-4" />}>
      <Row label="위키 내보내기">
        <Button size="sm">
          <Download className="size-3.5" />
          내보내기
        </Button>
      </Row>
      <Row label="원본 문서">
        <span className="text-[13px] text-muted tabular">{usage}</span>
      </Row>
    </SettingsSection>
  );
}
