import { useEffect, useState } from "react";
import { useCloud } from "./cloud";
import { Media } from "./ui";
import { pushBack } from "./back";
import { SPLASH_SECONDS, splashAd } from "./splash";

let shownThisLaunch = false;

/** Full-screen opening ad: once per app launch, closes itself after SPLASH_SECONDS or on skip. */
export function SplashAd() {
  const { data } = useCloud();
  const ad = data ? splashAd(data.settings, data.assets) : null;
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(SPLASH_SECONDS);
  const has = !!ad;
  useEffect(() => {
    if (!has || shownThisLaunch) return;
    shownThisLaunch = true;
    setOpen(true);
  }, [has]);
  useEffect(() => {
    if (!open) return;
    const off = pushBack(() => setOpen(false));
    const t = setInterval(() => setLeft(n => { if (n <= 1) { setOpen(false); return 0; } return n - 1; }), 1000);
    return () => { clearInterval(t); off(); };
  }, [open]);
  if (!open || !ad) return null;
  return (
    <div className="fixed inset-0 z-[80] mx-auto max-w-[440px] bg-night text-night-foreground" role="dialog" aria-label="إعلان">
      <Media src={ad.url} mime={ad.mime} alt="إعلان" className="absolute inset-0 h-full w-full !object-cover" loop={false} />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button type="button" onClick={() => setOpen(false)} className="press night-glass inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-black ring-1 ring-night-foreground/25">تخطي<span className="grid h-5 w-5 place-items-center rounded-full gold-bg text-[11px] text-navy" dir="ltr">{left}</span></button>
        <span className="night-glass rounded-full px-2.5 py-1 text-[10.5px] font-bold opacity-85">إعلان</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-night-foreground/15"><div className="splash-bar h-full gold-bg" style={{ animationDuration: `${SPLASH_SECONDS}s` }} /></div>
    </div>
  );
}
