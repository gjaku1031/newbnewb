import { UploadButton } from "@/components/wiki/UploadModal";
import { WikiHome } from "@/components/wiki/WikiHome";
import { sources, wikiPages } from "@/mocks/wiki";

export const metadata = { title: "위키 · newb" };

export default function WikiPage() {
  return (
    <div className="max-w-[1080px] px-6 pt-8 pb-20 lg:px-12 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-[32px] leading-tight font-bold tracking-[-0.025em]">위키</h1>
          <div className="mt-2 flex gap-3 text-[13px] text-faint tabular">
            <span>페이지 {wikiPages.length}</span>
            <span>·</span>
            <span>원본 {sources.length}</span>
          </div>
        </div>
        <UploadButton />
      </div>
      <div className="mt-8">
        <WikiHome />
      </div>
    </div>
  );
}
