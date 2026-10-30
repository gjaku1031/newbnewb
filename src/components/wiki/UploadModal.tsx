"use client";

import { useState } from "react";
import clsx from "clsx";
import { Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui";
import { sourceTypeLabel } from "@/lib/labels";
import type { SourceType } from "@/lib/types";
import { refresh } from "@/components/workspace/store";

const FORMATS = ["PDF", "DOCX", "XLSX", "PPTX", "HWP", "HWPX", "텍스트"];
const TYPES: SourceType[] = ["manual", "guideline", "boss_answer", "peer_advice", "note"];

export function UploadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Upload className="size-4" strokeWidth={2} />
        문서 추가
      </Button>
      {open && <UploadModal onClose={() => setOpen(false)} />}
    </>
  );
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState<SourceType>("guideline");
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.set("type", type);
    for (const f of files) form.append("files", f);
    try {
      const res = await fetch("/api/sources", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `올리지 못했어요 (${res.status})`);
      await refresh();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "올리지 못했어요");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[560px] rounded-2xl border border-line bg-surface shadow-pop">
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="text-[17px] font-semibold">위키에 문서 추가</h2>
          </div>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken"
          >
            <X className="size-4" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8">
            <div className="flex items-start gap-3 rounded-xl bg-accent-soft p-4">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" />
              <div className="text-[13.5px] leading-relaxed">
                <div className="font-semibold">원본 {files.length}개를 올렸어요</div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={onClose}>닫기</Button>
            </div>
          </div>
        ) : (
          <div className="px-6 pt-5 pb-6">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
              }}
              className={clsx(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-9 text-center transition-colors",
                dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-sunken",
              )}
            >
              <Upload className="size-6 text-muted" />
              <div className="mt-2 text-[14px] font-medium">파일을 끌어다 놓거나 클릭해서 선택</div>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {FORMATS.map((f) => (
                  <span key={f} className="rounded-[5px] bg-sunken px-1.5 py-0.5 text-[11.5px] text-muted">
                    {f}
                  </span>
                ))}
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])}
              />
            </label>

            {files.length > 0 && (
              <ul className="mt-3 space-y-1 text-[13px]">
                {files.map((f, i) => (
                  <li key={i} className="truncate rounded-md bg-sunken px-3 py-1.5">
                    {f.name}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5">
              <div className="mb-2 text-[13px] font-medium">어떤 자료인가요?</div>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={clsx(
                      "h-8 rounded-full border px-3 text-[13px] transition-colors",
                      type === t
                        ? "border-accent bg-accent-soft font-medium text-accent-ink"
                        : "border-line text-muted hover:bg-sunken",
                    )}
                  >
                    {sourceTypeLabel[t]}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                취소
              </Button>
              <Button variant="primary" onClick={upload} disabled={uploading || files.length === 0}>
                <Sparkles className="size-4" />
                {uploading ? "올리는 중…" : "위키로 정리하기"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
