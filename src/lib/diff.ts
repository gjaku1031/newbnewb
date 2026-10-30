/** 줄 단위 diff (LCS). 라이브러리 없이 git diff처럼 추가/삭제/같음을 계산한다 */

export type DiffLine =
  | { type: "same"; text: string; a: number; b: number }
  | { type: "del"; text: string; a: number }
  | { type: "add"; text: string; b: number };

export type DiffRow = DiffLine | { type: "skip"; count: number; from: number };

const split = (s: string) => (s === "" ? [] : s.replace(/\r\n/g, "\n").split("\n"));

export function diffLines(before: string, after: string): DiffLine[] {
  const A = split(before);
  const B = split(after);
  const n = A.length;
  const m = B.length;
  // dp[i][j] = A[i..], B[j..] 의 최장 공통 부분수열 길이
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ type: "same", text: A[i], a: i + 1, b: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: A[i], a: i + 1 });
      i++;
    } else {
      out.push({ type: "add", text: B[j], b: j + 1 });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: A[i], a: ++i });
  while (j < m) out.push({ type: "add", text: B[j], b: ++j });
  return out;
}

/** 바뀐 줄 주변(context줄)만 남기고 나머지 같은 줄은 접는다 */
export function collapse(lines: DiffLine[], context = 2): DiffRow[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, idx) => {
    if (l.type === "same") return;
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) keep[k] = true;
  });
  const rows: DiffRow[] = [];
  let run = 0;
  let runFrom = 0;
  lines.forEach((l, idx) => {
    if (keep[idx]) {
      if (run) rows.push({ type: "skip", count: run, from: runFrom });
      run = 0;
      rows.push(l);
    } else {
      if (!run) runFrom = idx;
      run++;
    }
  });
  if (run) rows.push({ type: "skip", count: run, from: runFrom });
  return rows;
}

export function diffStats(lines: DiffLine[]) {
  return {
    add: lines.filter((l) => l.type === "add").length,
    del: lines.filter((l) => l.type === "del").length,
  };
}
