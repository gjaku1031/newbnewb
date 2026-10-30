import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/ui";
import { WorkView } from "@/components/calendar/WorkView";

export const metadata: Metadata = { title: "작업 · newb" };

export default function TasksPage() {
  return (
    <>
      <PageHeader title="작업" />
      <PageBody>
        <WorkView />
      </PageBody>
    </>
  );
}
