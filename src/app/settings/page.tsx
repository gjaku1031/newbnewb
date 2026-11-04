import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/ui";
import { DashboardSettings } from "@/components/settings/DashboardSettings";
import { ClaudeSettings } from "@/components/settings/ClaudeSettings";
import { AccountSettings, DataSettings } from "@/components/settings/AccountSettings";
import { AiSettings } from "@/components/settings/AiSettings";

const SECTIONS = [
  { id: "dashboard", label: "대시보드 알림" },
  { id: "claude", label: "Claude Desktop 연결" },
  { id: "ai", label: "Claude API" },
  { id: "account", label: "로그인" },
  { id: "data", label: "데이터" },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="설정" />
      <PageBody>
        <div className="grid gap-8 lg:grid-cols-[180px_minmax(0,760px)]">
          <nav className="hidden lg:block">
            <ul className="sticky top-8 space-y-0.5 text-[13.5px]">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block rounded-md px-2.5 py-1.5 text-muted hover:bg-sunken hover:text-ink">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-6">
            <DashboardSettings />
            <Suspense fallback={null}>
              <ClaudeSettings />
            </Suspense>
            <Suspense fallback={null}>
              <AiSettings />
            </Suspense>
            <Suspense fallback={null}>
              <AccountSettings />
            </Suspense>
            <Suspense fallback={null}>
              <DataSettings />
            </Suspense>
          </div>
        </div>
      </PageBody>
    </>
  );
}
