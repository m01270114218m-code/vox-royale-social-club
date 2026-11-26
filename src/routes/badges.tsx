import { createFileRoute } from "@tanstack/react-router";
import { SubHeader } from "@/components/app/AppShell";
import { badgeArt } from "@/components/app/data";
import { meAsUser, useProfile, type Profile } from "@/components/app/profile";

export const Route = createFileRoute("/badges")({
  head: () => ({ meta: [{ title: "شاراتي | صدى شات" }, { name: "description", content: "كل الشارات التي حصلت عليها والشارات المتاحة للفتح" }, { property: "og:title", content: "شاراتي | صدى شات" }, { property: "og:description", content: "كل الشارات التي حصلت عليها والشارات المتاحة للفتح" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Badges,
});

type B = { k: string; n: string; img: string; how: string; ok: (p: Profile) => boolean };
const LIST: B[] = [
  { k: "vip", n: "شارة VIP", img: badgeArt.vip, how: "اشترك في VIP", ok: (p) => meAsUser(p).vip > 0 },
  { k: "lv10", n: "المستوى 10", img: badgeArt.level, how: "وصل للمستوى 10", ok: (p) => meAsUser(p).level >= 10 },
  { k: "owner", n: "مالك غرفة", img: badgeArt.owner, how: "امتلك غرفة خاصة", ok: () => true },
  { k: "sid", n: "صاحب ID مميز", img: badgeArt.id, how: "اشترِ رقماً مميزاً", ok: (p) => !!p.sid },
  { k: "gift", n: "داعم ذهبي", img: badgeArt.gift, how: "أرسل هدايا بقيمة 10,000", ok: (p) => p.stats.giftsOut >= 10000 },
  { k: "rocket", n: "داعم أسطوري", img: badgeArt.rocket, how: "أرسل هدايا بقيمة 100,000", ok: (p) => p.stats.giftsOut >= 100000 },
  { k: "host", n: "مضيف نشيط", img: badgeArt.host, how: "ساعة على المايك", ok: (p) => Object.values(p.stats.days).reduce((s, d) => s + d.mic, 0) >= 3600 },
  { k: "charm", n: "نجم الكاريزما", img: badgeArt.charm, how: "استلم هدايا بقيمة 5,000", ok: (p) => Object.values(p.stats.days).reduce((s, d) => s + d.gifts, 0) >= 5000 },
  { k: "agent", n: "وكيل معتمد", img: badgeArt.admin, how: "يُفعّل من الإدارة", ok: (p) => p.agentEnabled },
  { k: "bd", n: "BD", img: badgeArt.castle, how: "يُفعّل من الإدارة", ok: (p) => p.bdEnabled },
  { k: "fan", n: "صديق الجميع", img: badgeArt.fan, how: "تابع 5 أشخاص", ok: (p) => p.following.length >= 5 },
  { k: "wealth", n: "الثري", img: badgeArt.wealth, how: "رصيد 1,000,000 عملة", ok: (p) => p.coins >= 1000000 },
];

function Badges() {
  const p = useProfile();
  const got = LIST.filter((b) => b.ok(p));
  return (
    <div className="min-h-screen bg-night pb-6 text-night-foreground">
      <SubHeader title="شاراتي" dark />
      <div className="px-3.5">
        <div className="vip-card mb-3 flex items-center justify-between rounded-2xl border border-gold/50 px-4 py-3">
          <div><p className="text-gold-grad text-[26px] font-black leading-none">{got.length}/{LIST.length}</p><p className="mt-1 text-[11px] opacity-80">شارة حصلت عليها</p></div>
          <div className="flex -space-x-2 space-x-reverse">{got.slice(0, 4).map((b) => <img key={b.k} src={b.img} alt="" className="h-10 w-10 drop-shadow-lg" />)}</div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {LIST.map((b) => { const on = b.ok(p); return (
            <div key={b.k} className={`flex flex-col items-center rounded-2xl border px-1 py-3 text-center ${on ? "border-gold/60 bg-gold/10" : "border-night-foreground/10 bg-night-foreground/5"}`}>
              <img src={b.img} alt="" className={`h-14 w-14 ${on ? "drop-shadow-[0_0_10px_var(--gold)]" : "opacity-35 grayscale"}`} />
              <p className="mt-1.5 text-[12px] font-bold">{b.n}</p>
              <p className="text-[9.5px] opacity-60">{on ? "تم الحصول عليها" : b.how}</p>
            </div>
          ); })}
        </div>
      </div>
    </div>
  );
}
