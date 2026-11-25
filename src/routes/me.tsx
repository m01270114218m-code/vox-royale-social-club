import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Copy, Settings, Pencil } from "lucide-react";
import { toast } from "@/components/app/toast";
import { Coin } from "@/components/app/AppShell";
import { images, icons, gifts } from "@/components/app/data";
import { MY_UID, meAsUser, useProfile } from "@/components/app/profile";
import { Avatar, GenderChip, LevelChip, SpecialId, VipChip, UserBadges, UserName } from "@/components/app/ui";
import { useCloud } from '@/components/app/cloud';
import { canRecharge, canHost, canAdmin } from '@/components/app/control-rules';
import { openDaily } from '@/components/app/DailyCard';

export const Route = createFileRoute("/me")({
  head: () => ({ meta: [{ title: "حسابي | صدى شات" }, { name: "description", content: "ملفك الشخصي ومحفظتك وزيناتك وامتيازات VIP" }, { property: "og:title", content: "حسابي | صدى شات" }, { property: "og:description", content: "ملفك الشخصي ومحفظتك وزيناتك وامتيازات VIP" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Me,
});

function Me() {
  const {data}=useCloud();
  const p = useProfile();
  const u = meAsUser(p);
  const grid = [{ l: "المتجر", i: icons.shop, to: "/store" }, { l: "الشارات", i: icons.badge, to: "/badges" }, { l: "المستوى", i: icons.level, to: "/level" }, { l: "ID مميز", i: icons.id, to: "/store" }] as const;
  const menu = [
    { l: "المحفظة", i: icons.wallet, to: "/wallet", extra: true },
    ...(canHost(data?.roles ?? []) ? [{ l: p.gender === "f" ? "مركز المضيفة" : "مركز المضيف", i: icons.host, to: "/host" as const }] : []),
    ...(canAdmin(data?.roles ?? []) ? [{ l: 'لوحة التحكم', i: icons.bd, to: '/admin' as const }] : []),
  ] as const;
  const agents = [
    ...(canRecharge(data?.roles ?? []) ? [{ l: "وكيل الشحن", d: "بيع العملات للمستخدمين", i: icons.recharge, to: "/recharge-agent" as const }] : []),
    { l: "وكيل المضيفين", d: "إدارة وكالتك ومضيفيك", i: icons.hostAgent, to: "/agent" },
    ...(data?.roles.includes('bd') ? [{ l: "مركز BD", d: "إنشاء وكالات جديدة", i: icons.bd, to: "/bd" as const }] : []),
  ] as const;
  return (
    <div>
      <div className="relative min-h-[220px] pb-5">
        <img src={images.ice} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
        <div className="relative flex justify-end gap-1 px-3 pt-3">
          <Link to="/settings" aria-label="الإعدادات" className="press grid h-8 w-8 place-items-center rounded-full bg-secondary/70 text-navy backdrop-blur"><Settings className="h-4 w-4" /></Link>
        </div>
        <div className="relative flex items-center gap-3 px-4 pt-5">
          <Link to="/user/$id" params={{ id: "me" }} aria-label="ملفي الشخصي"><Avatar img={u.avatar} frame={p.frame} size={78} className="m-3" ring="border-2 border-secondary shadow-lg" /></Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="user-name text-[18px] font-black text-navy"><UserName uid={u.uid} name={u.name}/></h1>
              <GenderChip g={p.gender} />
            </div>
            <div className="mt-0.5 flex items-center gap-1"><LevelChip level={u.level} /><VipChip vip={u.vip} /><span className="text-[12px]">{p.flag}</span></div>
            <button onClick={() => { navigator.clipboard?.writeText(u.sid ?? u.uid); toast("تم نسخ ID"); }} className="mt-1 flex items-center gap-1 text-navy">
              <SpecialId uid={u.uid} sid={u.sid} className="text-[12px] font-semibold" /> <Copy className="h-3.5 w-3.5 opacity-70" />
            </button>
            <UserBadges userId={data?.profile?.id ?? ''} align="start"/>
          </div>
          <Link to="/me/edit" aria-label="تعديل الملف الشخصي" title="تعديل" className="press absolute left-4 top-0 grid h-8 w-8 place-items-center rounded-full bg-secondary/85 text-navy"><Pencil className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
      <div className="space-y-3 px-3.5 pb-3">
        <div className="surface grid grid-cols-3 py-2 text-center">
          {[["المتابعة", p.following.length], ["المعجبون", u.fans], ["الجاذبية", u.charm]].map(([l, v]) => (
            <div key={l as string} className="border-l last:border-0"><p className="text-[17px] font-black text-navy">{v}</p><p className="text-[11.5px] text-muted-foreground">{l}</p></div>
          ))}
        </div>
        <Link to="/vip" className="vip-card press relative flex items-center justify-between overflow-hidden rounded-2xl border border-ice px-4 py-3 shadow-lg">
          <div><p className="text-gold-grad text-[28px] font-black leading-none">VIP</p><p className="mt-1 text-[11px] text-primary-foreground/80">افتح VIP للاستمتاع بالامتيازات المميزة</p></div>
          <img src={gifts[3]!.img} alt="" className="h-14 w-14 drop-shadow-lg" />
        </Link>
        <div className="surface grid grid-cols-4 py-3">
          {grid.map((g) => <Link key={g.l} to={g.to} className="press flex flex-col items-center gap-1"><img src={g.i} alt="" className="h-10 w-10" /><span className="text-[12px] font-bold text-navy">{g.l}</span></Link>)}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {agents.map((g) => (
            <Link key={g.l} to={g.to} className="agent-tile press relative flex flex-col items-center gap-1 overflow-hidden rounded-2xl px-2 py-3 text-center">
              <img src={g.i} alt="" className="h-12 w-12 shrink-0 drop-shadow-md" />
              <span className="w-full min-w-0"><span className="block truncate text-[13.5px] font-black text-navy">{g.l}</span><span className="block truncate text-[10.5px] text-muted-foreground">{g.d}</span></span>
            </Link>
          ))}
        </div>
        <div className="surface divide-y overflow-hidden">
          <button type="button" onClick={openDaily} className="flex h-[52px] w-full items-center gap-3 px-3 text-start active:bg-muted">
            <img src={icons.rewards} alt="" className="h-7 w-7" />
            <span className="flex-1 text-[14px] font-semibold text-navy">هدية الدخول اليومي</span>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          {menu.map((m) => (
            <Link key={m.l} to={m.to} className="flex h-[52px] items-center gap-3 px-3 active:bg-muted">
              <img src={m.i} alt="" className="h-7 w-7" />
              <span className="flex-1 text-[14px] font-semibold text-navy">{m.l}</span>
              {"extra" in m && <span className="flex gap-2 text-[12px] text-navy"><Coin n={data?.profile?.diamonds ?? 0} gem /><Coin n={data?.profile?.coins ?? 0} /></span>}
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
