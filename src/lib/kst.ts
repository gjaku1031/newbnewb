/** DB 기록 시각(UTC "YYYY-MM-DD HH:mm:ss[.fff]") → 한국 시간 "YYYY-MM-DD HH:mm" */
export function utcToKst(utc: string | null | undefined) {
  if (!utc) return null;
  const d = new Date(`${utc.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
