import { useEffect, useState } from "react";
import { ui } from "./data";

type T = { id: number; msg: string; desc?: string };
let current: T | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<(t: T | null) => void>();

/** How long a toast stays on screen (ms). */
export const TOAST_MS = 1000;

function show(msg: string, opts?: { description?: string }) {
  current = { id: Date.now(), msg, ...(opts?.description ? { desc: opts.description } : {}) };
  subs.forEach((s) => s(current));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    subs.forEach((s) => s(null));
  }, TOAST_MS);
}

/** Android-style toast: a single dark pill at the bottom that disappears after one second. */
export const toast = Object.assign(show, { success: show, error: show });

export function AndroidToaster() {
  const [t, setT] = useState<T | null>(null);
  useEffect(() => {
    subs.add(setT);
    return () => void subs.delete(setT);
  }, []);
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[92px] z-[100] mx-auto flex max-w-[440px] justify-center px-6" role="status" aria-live="polite">
      <div key={t.id} className="android-toast flex max-w-[300px] items-center gap-2 rounded-full py-1.5 pe-4 ps-1.5 text-[12.5px] leading-snug">
        <img src={ui.castle} alt="" className="h-6 w-6 shrink-0 rounded-full bg-night-foreground/10 p-0.5" />
        <span>
          {t.msg}
          {t.desc && <span className="block text-[10.5px] opacity-70">{t.desc}</span>}
        </span>
      </div>
    </div>
  );
}
