"use client";

import { useEffect, useState } from "react";
import { Agentation } from "agentation";

/**
 * 화면에 주석을 달아 Claude Code에 바로 전달하는 Agentation 툴바.
 * - 로그인한 사용자에게만 보인다 (/api/auth/me 확인)
 * - 주석은 같은 주소의 /api/agentation 프록시로 보내고, 서버에서 다시 로그인을 확인한다
 *   → Windows·Mac·iPhone·iPad 어느 기기에서 접속해도 같은 방식으로 동작
 */
export function AgentationToolbar() {
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { user?: unknown } | null) => {
        if (alive && body?.user) setEndpoint(`${window.location.origin}/api/agentation`);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!endpoint) return null;
  return <Agentation endpoint={endpoint} appName="newb" />;
}
