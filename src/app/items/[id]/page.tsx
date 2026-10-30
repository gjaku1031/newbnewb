import type { Metadata } from "next";
import { ItemDetail } from "@/components/item/ItemDetail";
import { getItem, items } from "@/mocks/items";

export function generateStaticParams() {
  return items.map((i) => ({ id: i.id }));
}

export async function generateMetadata(props: PageProps<"/items/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const it = getItem(id);
  return { title: it ? `${it.title} · newb` : "항목 · newb" };
}

/** 항목 상세 — 데이터는 클라이언트 스토어에서 읽어 작업 화면과 같은 내용을 보여준다 */
export default async function ItemPage(props: PageProps<"/items/[id]">) {
  const { id } = await props.params;
  return <ItemDetail id={id} />;
}
