/** 위키 복습 간격 — 망각 곡선 계산은 내부에서만 (지금은 단순히 2배, 최대 60일) */
export function nextInterval(days: number) {
  return Math.min(60, Math.max(1, days * 2));
}
