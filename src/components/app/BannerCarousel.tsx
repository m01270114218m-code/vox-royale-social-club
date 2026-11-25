import { useEffect, useRef, useState } from "react";
import { Media } from "./ui";

export const BANNER_ROTATE_MS = 3500;
/** Slide shown after `i` when rotating automatically; wraps to the first. */
export const nextSlide = (i: number, count: number) => (count > 0 ? (i + 1) % count : 0);

type Slide = { id: string; name: string; url: string; mime?: string | null | undefined; link: string | null };

/** All banners in one rectangle that rotates by itself; swipe or tap a dot to change. */
export function BannerCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const start = useRef<number | null>(null);
  const n = slides.length;
  const cur = n ? Math.min(i, n - 1) : 0;
  useEffect(() => {
    if (n < 2 || hold) return;
    const t = setInterval(() => setI(v => nextSlide(v, n)), BANNER_ROTATE_MS);
    return () => clearInterval(t);
  }, [n, hold]);
  if (!n) return null;
  const end = (x: number) => {
    const d = start.current === null ? 0 : x - start.current;
    start.current = null; setHold(false);
    if (Math.abs(d) > 36) setI((cur + (d < 0 ? 1 : n - 1)) % n);
  };
  return (
    <div className="surface relative overflow-hidden" dir="ltr" aria-roledescription="carousel"
      onTouchStart={e => { start.current = e.touches[0]?.clientX ?? null; setHold(true); }}
      onTouchEnd={e => end(e.changedTouches[0]?.clientX ?? 0)}>
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${cur * 100}%)` }}>
        {slides.map((s, k) => {
          const link = s.link && /^https:\/\//.test(s.link) ? s.link : "";
          const inner = s.url
            ? <Media src={s.url} mime={s.mime} alt={s.name} className="aspect-[2.6/1] w-full !object-cover" />
            : <div className="vip-card grid aspect-[2.6/1] w-full place-items-center px-4 text-center text-[15px] font-black text-night-foreground" dir="rtl">{s.name}</div>;
          return link
            ? <a key={s.id} href={link} target="_blank" rel="noopener noreferrer" aria-hidden={k !== cur} tabIndex={k === cur ? 0 : -1} className="block w-full shrink-0">{inner}</a>
            : <div key={s.id} aria-hidden={k !== cur} className="w-full shrink-0">{inner}</div>;
        })}
      </div>
      {n > 1 && <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
        {slides.map((s, k) => <button key={s.id} type="button" aria-label={`بنر ${k + 1}`} aria-current={k === cur} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === cur ? "w-4 gold-bg" : "w-1.5 bg-night-foreground/70"}`} />)}
      </div>}
    </div>
  );
}
