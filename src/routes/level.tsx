import { createFileRoute } from "@tanstack/react-router";
import { IceHeader, SubHeader } from "@/components/app/AppShell";
import { icons, ui } from "@/components/app/data";
import { meAsUser, useProfile } from "@/components/app/profile";
import { Avatar, LevelChip } from "@/components/app/ui";

export const Route = createFileRoute("/level")({
  head: () => ({
    meta: [
      { title: "المستوى | صدى شات" },
      { name: "description", content: "مستوى حسابك ونقاط الخبرة والترقيات في صدى شات" },
      { property: "og:title", content: "المستوى | صدى شات" },
      { property: "og:description", content: "مستوى حسابك ونقاط الخبرة والترقيات في صدى شات" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LevelPage,
});

const TIERS = [
  { lv: "Lv.1 – Lv.9", name: "مبتدئ", desc: "شارة المستوى الأساسية في الغرف", cls: "from-sky-400/20 to-sky-500/5", img: icons.level },
  { lv: "Lv.10 – Lv.24", name: "نجم صاعد", desc: "لون شارة مميز وأولوية في قائمة المتواجدين", cls: "from-blue-500/20 to-indigo-500/5", img: icons.badge },
  { lv: "Lv.25 – Lv.39", name: "فارس الجليد", desc: "إطار مستوى خاص وتأثير دخول أسرع", cls: "from-violet-500/20 to-purple-500/5", img: ui.castle },
  { lv: "Lv.40+", name: "أسطورة القصر", desc: "تأثير متوهج على الاسم وشارة ذهبية نادرة", cls: "from-amber-400/25 to-yellow-500/5", img: ui.gem },
];

function LevelPage() {
  const p = useProfile();
  const u = meAsUser(p);
  const xp = Math.max(0, u.wealth + u.charm);
  const nextTarget = (u.level + 1) * 2000;
  const progress = Math.min(100, Math.round(((xp % nextTarget) / nextTarget) * 100));
  const remaining = Math.max(0, nextTarget - (xp % nextTarget));

  return (
    <div className="min-h-screen pb-8">
      <IceHeader tall>
        <div className="-mx-3.5 -mt-4">
          <SubHeader title="مستواي" transparent />
        </div>
        <div className="mt-2 flex flex-col items-center text-center">
          <Avatar img={u.avatar} frame={p.frame} size={84} className="my-2" ring="border-2 border-secondary shadow-lg" />
          <h2 className="mt-1 text-[18px] font-black text-navy">{u.name}</h2>
          <div className="mt-1 flex items-center gap-1.5">
            <LevelChip level={u.level} />
            <span className="text-[12px] font-bold text-navy/75">المستوى الحالي</span>
          </div>
        </div>
      </IceHeader>

      <div className="space-y-3 px-3.5 pt-2">
        <div className="room-card-pro p-4">
          <div className="flex items-center justify-between text-[12.5px] font-extrabold text-navy">
            <span>Lv.{u.level}</span>
            <span className="text-primary">{progress}%</span>
            <span>Lv.{u.level + 1}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
            <div className="gold-bg h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(8, progress)}%` }} />
          </div>
          <p className="mt-2 text-center text-[11.5px] text-muted-foreground">
            متبقي <b className="text-navy">{remaining.toLocaleString("en")}</b> نقطة للوصول إلى المستوى {u.level + 1}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="room-card-pro flex items-center gap-2.5 p-3">
            <img src={ui.wealth} alt="" className="h-10 w-10 shrink-0 object-contain drop-shadow-sm" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">نقاط الثروة</p>
              <p className="truncate text-[15px] font-black text-navy">{u.wealth.toLocaleString("en")}</p>
            </div>
          </div>
          <div className="room-card-pro flex items-center gap-2.5 p-3">
            <img src={ui.charm} alt="" className="h-10 w-10 shrink-0 object-contain drop-shadow-sm" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">نقاط الكاريزما</p>
              <p className="truncate text-[15px] font-black text-navy">{u.charm.toLocaleString("en")}</p>
            </div>
          </div>
        </div>

        <div className="room-card-pro p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-black text-navy">
            <img src={icons.level} alt="" className="h-5 w-5 object-contain" />مراحل المستويات
          </p>
          <div className="space-y-2">
            {TIERS.map((t) => (
              <div key={t.lv} className={`flex items-center gap-3 rounded-xl bg-gradient-to-l ${t.cls} px-3 py-2.5`}>
                <img src={t.img} alt="" className="h-9 w-9 shrink-0 object-contain drop-shadow" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-extrabold text-navy">{t.name}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black text-primary">{t.lv}</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
