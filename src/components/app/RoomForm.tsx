import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronRight, ImagePlus, Megaphone, PencilLine, Sparkles } from "lucide-react";
import { useCloudActions } from "./cloud";
import { readImageFile } from "./imageUpload";
import { images, roomCover, roomCovers } from "./data";
import { pushBack } from "./back";
import { toast } from "./toast";

const NAME_MAX = 24;
const NOTICE_MAX = 200;
const nameIdeas = ["سهرة الأصدقاء", "ليالي الطرب", "مجلس الكرام", "دردشة وضحك"];
const noticeIdeas = [
  "أهلاً بكم في غرفتي، الاحترام أولاً والجميع مرحّب به.",
  "ممنوع الإساءة والإعلانات. استمتعوا بوقتكم معنا.",
  "سهرة يومية بعد العاشرة مساءً، تابع الغرفة ليصلك التنبيه.",
];

/** Full-screen studio to create or edit the user's own room: picture, name and announcement. */
export function RoomForm({ initial, uid, onDone, onClose }: { initial?: { name: string; notice: string; cover: string } | undefined; uid: string; onDone: () => void; onClose: () => void }) {
  const act = useCloudActions();
  const [name, setName] = useState(initial?.name ?? "");
  const [notice, setNotice] = useState(initial?.notice ?? "");
  const [cover, setCover] = useState<string | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => pushBack(() => close.current()), []);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try { setCover(await readImageFile(f, 320, 0.8)); setPreset(null); } catch { toast("تعذّر قراءة الصورة، اختر ملف صورة صالحاً"); }
  };
  const pickPreset = async (src: string) => {
    setPreset(src);
    try {
      const blob = await (await fetch(src)).blob();
      setCover(await readImageFile(new File([blob], "cover", { type: blob.type || "image/webp" }), 320, 0.8));
    } catch { setPreset(null); toast("تعذّر تحميل الصورة، جرّب صورة أخرى"); }
  };

  const shown = cover || initial?.cover || roomCover;
  const trimmed = name.trim();
  const ok = trimmed.length >= 2 && trimmed.length <= NAME_MAX;
  const save = async () => {
    setBusy(true);
    const done = await act("room_save", { name: trimmed, notice: notice.trim(), ...(cover ? { cover } : {}) }, initial ? "تم حفظ الغرفة" : "تم إنشاء غرفتك");
    setBusy(false);
    if (done) onDone();
  };
  const field = "mt-1.5 w-full rounded-xl night-glass px-3 text-night-foreground outline-none ring-1 ring-night-foreground/15 placeholder:text-night-foreground/40 focus:ring-gold";

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[440px] flex-col bg-night text-night-foreground sheet-up">
      <img src={shown} alt="" className="pointer-events-none absolute inset-x-0 top-0 h-[300px] w-full scale-110 object-cover opacity-45 blur-2xl" />
      <img src={images.room} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-night/70 to-night" />

      <header className="relative flex h-12 shrink-0 items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onClose} aria-label="رجوع" className="press grid h-8 w-8 place-items-center rounded-full night-glass"><ChevronRight className="h-5 w-5" /></button>
        <h1 className="flex-1 text-[16px] font-black">{initial ? "تعديل غرفتي" : "إنشاء غرفة"}</h1>
        <span className="id-glass inline-flex h-[22px] items-center gap-1 rounded-full pe-2.5 ps-0.5 text-[12px] font-black" dir="ltr"><span className="id-glass-tag">ID</span>{uid}</span>
      </header>

      <div className="no-scrollbar relative flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-2">
        <section className="flex flex-col items-center">
          <button type="button" onClick={() => file.current?.click()} aria-label="تغيير صورة الغرفة" className="press relative">
            <img src={shown} alt="" className="gold-ring h-[104px] w-[104px] rounded-[26px] object-cover shadow-xl" />
            <span className="absolute -bottom-1.5 -left-1.5 grid h-8 w-8 place-items-center rounded-full gold-bg text-navy shadow-md"><Camera className="h-4 w-4" strokeWidth={2.6} /></span>
          </button>
          <p className={`mt-3 max-w-full truncate text-[17px] font-black ${trimmed ? "text-gold-grad" : "opacity-45"}`}>{trimmed || "اسم غرفتك"}</p>
          <p className="mt-0.5 text-[11px] opacity-65">رقم الغرفة هو نفس رقم حسابك</p>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </section>

        <section>
          <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold"><ImagePlus className="h-4 w-4 text-gold" />صورة الغرفة</p>
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2.5 overflow-x-auto px-4 pb-1">
            <button type="button" onClick={() => file.current?.click()} className="press flex h-[62px] w-[62px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed border-gold/70 night-glass text-[10px] font-bold text-gold"><Camera className="h-5 w-5" />من الهاتف</button>
            {roomCovers.map((c) => (
              <button key={c} type="button" onClick={() => void pickPreset(c)} aria-label="صورة جاهزة" aria-pressed={preset === c} className={`press relative h-[62px] w-[62px] shrink-0 overflow-hidden rounded-2xl ${preset === c ? "gold-ring" : "ring-1 ring-night-foreground/20"}`}>
                <img src={c} alt="" className="h-full w-full object-cover" />
                {preset === c && <span className="absolute inset-0 grid place-items-center bg-night/45"><span className="grid h-6 w-6 place-items-center rounded-full gold-bg text-navy"><Check className="h-4 w-4" strokeWidth={3} /></span></span>}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label htmlFor="room-name" className="flex items-center gap-1.5 text-[12.5px] font-extrabold"><PencilLine className="h-4 w-4 text-gold" />اسم الغرفة<span className="ms-auto text-[11px] font-bold opacity-60" dir="ltr">{name.length}/{NAME_MAX}</span></label>
          <input id="room-name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسماً مميزاً لغرفتك" className={`${field} h-11 text-[14.5px] font-bold`} />
          <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
            {nameIdeas.map((n) => <button key={n} type="button" onClick={() => setName(n)} className="press shrink-0 rounded-full night-glass px-3 py-1 text-[11.5px] font-bold ring-1 ring-night-foreground/15">{n}</button>)}
          </div>
          {name.length > 0 && !ok && <p className="mt-1.5 text-[11px] font-bold text-destructive">الاسم من حرفين إلى {NAME_MAX} حرفاً</p>}
        </section>

        <section>
          <label htmlFor="room-notice" className="flex items-center gap-1.5 text-[12.5px] font-extrabold"><Megaphone className="h-4 w-4 text-gold" />إعلان الغرفة<span className="ms-auto text-[11px] font-bold opacity-60" dir="ltr">{notice.length}/{NOTICE_MAX}</span></label>
          <textarea id="room-notice" value={notice} maxLength={NOTICE_MAX} rows={4} onChange={(e) => setNotice(e.target.value)} placeholder="رحّب بضيوفك واكتب قواعد الغرفة" className={`${field} resize-none py-2.5 text-[13px] leading-relaxed`} />
          <p className="mt-2 flex items-center gap-1 text-[11px] font-bold opacity-65"><Sparkles className="h-3.5 w-3.5 text-gold" />إعلانات جاهزة</p>
          <div className="mt-1.5 space-y-1.5">
            {noticeIdeas.map((n) => <button key={n} type="button" onClick={() => setNotice(n)} className="press block w-full rounded-xl night-glass px-3 py-2 text-start text-[11.5px] leading-snug ring-1 ring-night-foreground/10">{n}</button>)}
          </div>
        </section>
      </div>

      <footer className="relative shrink-0 border-t border-night-foreground/10 bg-night/85 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button type="button" disabled={!ok || busy} onClick={() => void save()} className="press h-12 w-full rounded-full gold-bg text-[15.5px] font-black text-navy shadow-lg disabled:opacity-45">{busy ? "جارٍ الحفظ…" : initial ? "حفظ التعديلات" : "إنشاء الغرفة"}</button>
      </footer>
    </div>
  );
}
