import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/ui";
import { CalendarView } from "@/components/calendar/CalendarView";

export const metadata: Metadata = { title: "캘린더 · newb" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="캘린더" />
      <PageBody>
        <CalendarView />
      </PageBody>
    </>
  );
}
