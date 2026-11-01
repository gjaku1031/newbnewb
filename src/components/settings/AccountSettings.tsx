import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { Database, Download, KeyRound } from "lucide-react";
import { Button } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/server/db/client";
import { sources } from "@/server/db/schema";
import { Row, SettingsSection } from "./Section";

export function AccountSettings() {
  return (
    <SettingsSection id="account" title="로그인" icon={<KeyRound className="size-4" />}>
      {/* TODO(Passkey): 등록한 Passkey 목록·추가·삭제 */}
      <div className="px-6 py-4 text-[13.5px] text-muted">
        등록한 Passkey가 없어요. Passkey 로그인은 준비 중이에요.
      </div>
      <div className="px-6 pb-4">
        <Button size="sm" disabled>
          <KeyRound className="size-3.5" />이 기기에 Passkey 추가
        </Button>
      </div>
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
