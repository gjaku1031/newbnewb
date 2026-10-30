import { redirect } from "next/navigation";

/** 예전 상세 화면 주소 — 이제 상세는 사이드 패널에서만 본다 */
export default async function ItemPage(props: PageProps<"/items/[id]">) {
  const { id } = await props.params;
  redirect(`/tasks?item=${encodeURIComponent(id)}`);
}
