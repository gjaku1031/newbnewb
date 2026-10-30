import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/ui";
import { RescheduleView } from "@/components/reschedule/RescheduleView";

export const metadata: Metadata = { title: "재배치 제안 · newb" };

export default function ReschedulePage() {
  return (
    <>
      <PageHeader title="우선순위 재배치 제안" />
      <PageBody>
        <RescheduleView />
      </PageBody>
    </>
  );
}
