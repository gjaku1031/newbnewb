/** 상세 페이지 로딩 중 보여줄 뼈대 (Suspense fallback) */
export function PageSkeleton() {
  return (
    <div className="animate-pulse px-6 pt-8 lg:px-10" aria-busy="true" aria-label="불러오는 중">
      <div className="h-3.5 w-24 rounded bg-sunken" />
      <div className="mt-4 h-7 w-[min(520px,80%)] rounded bg-sunken" />
      <div className="mt-3 h-4 w-[min(360px,60%)] rounded bg-sunken" />
      <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-72 rounded-xl bg-sunken" />
        <div className="h-48 rounded-xl bg-sunken" />
      </div>
    </div>
  );
}
