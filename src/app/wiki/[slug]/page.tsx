import { notFound } from "next/navigation";
import { WikiPageView } from "@/components/wiki/WikiPageView";
import { wikiTitle } from "@/server/queries";

export async function generateMetadata(props: PageProps<"/wiki/[slug]">) {
  const { slug } = await props.params;
  const title = await wikiTitle(decodeURIComponent(slug));
  return { title: title ? `${title} · 위키 · newb` : "위키 · newb" };
}

export default async function WikiDetailPage(props: PageProps<"/wiki/[slug]">) {
  const { slug } = await props.params;
  const decoded = decodeURIComponent(slug);
  if (!(await wikiTitle(decoded))) notFound();
  return <WikiPageView slug={decoded} />;
}
