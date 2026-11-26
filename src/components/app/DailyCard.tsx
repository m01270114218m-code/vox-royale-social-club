import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useCloud, cloudAction } from "./cloud";
import { ui } from "./data";
import { VipChip } from "./ui";
import { toast } from "./toast";
import { pushBack } from "./back";
import { DAILY_REWARDS, DAILY_VIP_DAYS, DAY_MS, dailyDue, nextDailyDay } from "./daily";

let manual = false;
const subs = new Set<() => void>();
/** Open the daily card on demand (from the "me" page). */
export function openDaily() { manual = true; subs.forEach((s) => s()); }
const closeManual = () => { manual = false; subs.forEach((s) => s()); };

/** Daily sign-in reward card. Pops up by itself at most once every 24 hours. */
export function DailyCard() {
  const { data } = useCloud();
  const qc = useQueryClient();
  const asked = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => manual, () => false);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = data?.profile;
  const id = p?.id;
  const lastAt = p?.daily_at ?? null;
  useEffect(() => {
    if (!id) return;
    const now = Date.now();
    if (!dailyDue(lastAt, now)) return;
    const key = `sada-daily-shown-${id}`;
    let shown = 0;
    try { shown = Number(window.localStorage.getItem(key) ?? 0); } catch { /* ignore */ }
    if (now - shown < DAY_MS) return;
    try { window.localStorage.setItem(key, String(now)); } catch { /* ignore */ }
    setAuto(true);
  }, [id, lastAt]);
  const open = !!p && (auto || asked);
  const close = () => { setAuto(false); closeManual(); };
  useEffect(() => (open ? pushBack(close) : undefined), [open]);
  if (!open || !p) return null;
  const now = Date.now();
  const due = dailyDue(p.daily_at, now);
  const today = due ? nextDailyDay(p.daily_day, p.daily_at, now) : p.daily_day;
  const done = (day: number) => (due ? day < today : day <= today);
  const waitH = p.daily_at ? Math.max(1, Math.ceil((Date.parse(p.daily_at) + DAY_MS - now) / 3600000)) : 0;
  const claim = async () => {
    setBusy(true);
    try {
      const res = await cloudAction("daily", {});
      await qc.invalidateQueries({ queryKey: ["cloud"] });
      const coins = Number(res["coins"] ?? 0); const vip = Number(res["vip"] ?? 0);
      toast(`تم استلام ${[vip ? `VIP${vip}` : "", coins ? `${coins.toLocaleString("en")} عملة` : ""].filter(Boolean).join(" + ")}`);
      close();
    } catch (e) { toast(e instanceof Error ? e.message : "تعذّر الاستلام"); }
    finally { setBusy(false); }
  };
  return (
    <div className="sheet-backdrop fixed inset-0 z-[70] mx-auto grid max-w-[440px] place-items-center px-5" role="dialog" aria-modal="true" aria-label="هدية الدخول اليومي">
      <div className="daily-card pop-in relative w-full overflow-hidden rounded-[26px] p-4 text-night-foreground shadow-2xl">
        <button type="button" onClick={close} aria-label="إغلاق" className="press absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full night-glass"><X className="h-4 w-4" /></button>
        <div className="text-center">
          <img src={ui.castle} alt="" className="mx-auto h-14 w-14 object-contain drop-shadow-lg" />
          <h2 className="text-gold-grad mt-1 text-[21px] font-black leading-tight">هدية الدخول اليومي</h2>
          <p className="mt-0.5 text-[11.5px] opacity-80">ادخل كل يوم واستلم مكافأة أكبر</p>
        </div>
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {DAILY_REWARDS.map((r, i) => {
            const day = i + 1; const isToday = due && day === today; const got = done(day);
            return (
              <div key={day} className={`daily-day relative flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center ${day === 7 ? "col-span-3 flex-row gap-3 py-3" : "min-h-[92px]"} ${isToday ? "daily-day-on" : ""} ${got ? "opacity-55" : ""}`}>
                <span className={`text-[10.5px] font-black ${isToday ? "text-navy" : "opacity-80"}`}>اليوم {day}</span>
                <span className="flex items-center gap-1.5">
                  {r.vip > 0 && <span className="scale-125"><VipChip vip={r.vip} /></span>}
                  {r.coins > 0 && <img src={ui.coin} alt="" className="h-7 w-7 drop-shadow" />}
                </span>
                <span className={`text-[11px] font-black leading-tight ${isToday ? "text-navy" : "text-gold"}`} dir="ltr">{[r.vip ? `VIP${r.vip}` : "", r.coins ? r.coins.toLocaleString("en") : ""].filter(Boolean).join(" + ")}</span>
                {got && <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary"><Check className="h-3 w-3" strokeWidth={3} /></span>}
              </div>
            );
          })}
        </div>
        <button type="button" disabled={!due || busy} onClick={() => void claim()} className="press mt-3.5 h-11 w-full rounded-full gold-bg text-[14.5px] font-black text-navy shadow-lg disabled:opacity-60">
          {busy ? "جارٍ الاستلام…" : due ? `استلام مكافأة اليوم ${today}` : `عد بعد ${waitH} ساعة`}
        </button>
        <p className="mt-2 text-center text-[10px] opacity-65">VIP من البطاقة يستمر {DAILY_VIP_DAYS === 1 ? "يوماً واحداً" : `${DAILY_VIP_DAYS} أيام`}</p>
      </div>
    </div>
  );
}
