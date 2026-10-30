"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { deleteItem, updateItem, useItem, useTags } from "@/lib/itemStore";
import { DetailPanel } from "@/components/calendar/DetailPanel";

const PARAM = "item";

/** 항목 링크: 다른 화면으로 넘어가지 않고 지금 화면 위에 사이드 패널로 연다 (노션 사이드 픽) */
export function ItemLink({
  id,
  className,
  style,
  children,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <Link href={`${pathname}?${PARAM}=${encodeURIComponent(id)}`} scroll={false} className={className} style={style}>
      {children}
    </Link>
  );
}

/** 주소에 ?item=… 이 있으면 그 항목을 사이드 패널로 보여준다. 루트 레이아웃에 하나만 둔다 */
export function ItemPeek() {
  const params = useSearchParams();
  // 주소의 ?item=… 은 브라우저에서 읽으므로 패널은 브라우저에서만 그린다 (서버 HTML과 어긋나지 않게)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const id = params.get(PARAM);
  return mounted && id ? <Peek id={id} /> : null;
}

function Peek({ id }: { id: string }) {
  const item = useItem(id);
  const tags = useTags();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete(PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (!item) return null;
  return (
    <DetailPanel
      item={item}
      tags={tags}
      onUpdate={(fn) => updateItem(id, fn)}
      onDelete={() => {
        deleteItem(id);
        close();
      }}
      onClose={close}
    />
  );
}
