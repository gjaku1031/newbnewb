import { notFound } from "next/navigation";
import { QuestionDetail } from "@/components/questions/QuestionDetail";
import { questionTitle } from "@/server/queries";

export async function generateMetadata(props: PageProps<"/questions/[id]">) {
  const { id } = await props.params;
  const title = await questionTitle(id);
  return { title: title ? `${title} · 질문 기록 · newb` : "질문 기록 · newb" };
}

export default async function QuestionDetailPage(props: PageProps<"/questions/[id]">) {
  const { id } = await props.params;
  if (!(await questionTitle(id))) notFound();
  return <QuestionDetail id={id} />;
}
