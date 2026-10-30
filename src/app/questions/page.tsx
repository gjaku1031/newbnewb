import { PageBody, PageHeader } from "@/components/ui";
import { QuestionList } from "@/components/questions/QuestionList";
import { questions } from "@/mocks/questions";

export const metadata = { title: "질문 기록 · newb" };

export default function QuestionsPage() {
  return (
    <>
      <PageHeader title="질문 기록" />
      <PageBody>
        <QuestionList items={questions} />
      </PageBody>
    </>
  );
}
