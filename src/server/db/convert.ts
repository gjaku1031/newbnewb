/** DB 값 ↔ 화면 값 변환 */

/** DATETIME "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm" */
export function dtOut(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  return v.replace(" ", "T").slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" → DATETIME 문자열 */
export function dtIn(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.replace("T", " ");
  return s.length === 16 ? `${s}:00` : s.slice(0, 19);
}

/** DATE → "YYYY-MM-DD" (드라이버가 시간까지 붙여 줄 때 대비) */
export function dOut(v: string | null | undefined): string | undefined {
  return v ? v.slice(0, 10) : undefined;
}

/** null → undefined (화면 타입은 선택 필드를 undefined로 씀) */
export function opt<T>(v: T | null | undefined): T | undefined {
  return v ?? undefined;
}
