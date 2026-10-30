import { Database, Download, KeyRound, Laptop, Smartphone, Tablet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Row, SettingsSection } from "./Section";

const PASSKEYS = [
  { id: "pk1", name: "Windows Hello · 회사 노트북", icon: Laptop, added: "2026-10-20", last: "오늘 08:52" },
  { id: "pk2", name: "iPhone (iCloud 키체인)", icon: Smartphone, added: "2026-10-20", last: "어제 21:14" },
  { id: "pk3", name: "iPad (iCloud 키체인)", icon: Tablet, added: "2026-10-24", last: "10/28" },
];

export function AccountSettings() {
  return (
    <SettingsSection
      id="account"
      title="로그인"
      icon={<KeyRound className="size-4" />}
    >
      <ul className="divide-y divide-line">
        {PASSKEYS.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-6 py-3.5">
            <span className="grid size-9 place-items-center rounded-lg bg-sunken text-muted">
              <p.icon className="size-[18px]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">{p.name}</div>
              <div className="text-[12.5px] text-muted tabular">
                등록 {p.added} · 마지막 사용 {p.last}
              </div>
            </div>
            <Button variant="ghost" size="sm" aria-label={`${p.name} 삭제`}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="px-6 py-3.5">
        <Button size="sm">
          <KeyRound className="size-3.5" />이 기기에 Passkey 추가
        </Button>
      </div>
    </SettingsSection>
  );
}

export function DataSettings() {
  return (
    <SettingsSection id="data" title="데이터" icon={<Database className="size-4" />}>
      <Row label="위키 내보내기">
        <Button size="sm">
          <Download className="size-3.5" />
          내보내기
        </Button>
      </Row>
      <Row label="원본 문서">
        <span className="text-[13px] text-muted tabular">48.2 MB</span>
      </Row>
    </SettingsSection>
  );
}
