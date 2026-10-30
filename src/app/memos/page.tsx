import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/ui";
import { MemoBoard } from "@/components/memo/MemoBoard";

export const metadata: Metadata = { title: "메모 · newb" };

export default function MemosPage() {
  return (
    <>
      <PageHeader title="메모" />
      <PageBody>
        <MemoBoard />
      </PageBody>
    </>
  );
}
