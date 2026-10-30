/**
 * "오늘"·"지금" — 한국 시간 기준.
 *
 * 화면 곳곳에서 상수처럼 읽기 때문에 모듈 변수로 두고, 서버가 보낸 작업공간 스냅샷의 시각으로
 * syncClock()이 맞춘다 (서버는 요청마다, 브라우저는 처음 불러올 때와 다시 불러올 때).
 * ES 모듈은 live binding이라 `import { TODAY }` 한 쪽도 바뀐 값을 읽는다.
 */

const TIME_ZONE = "Asia/Seoul";

const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 한국 시간 "YYYY-MM-DDTHH:mm" */
export function seoulNow(date = new Date()): string {
  return formatter.format(date).replace(" ", "T");
}

/** 한국 시간 "YYYY-MM-DD" */
export function seoulToday(date = new Date()): string {
  return seoulNow(date).slice(0, 10);
}

export let TODAY = seoulToday();
export let NOW = seoulNow();

export function syncClock(now: string) {
  NOW = now;
  TODAY = now.slice(0, 10);
}
