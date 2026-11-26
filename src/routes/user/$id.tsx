import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Check, MessageCircle, Gift as GiftIcon, Pencil } from "lucide-react";
import { toast } from "@/components/app/toast";
import { SubHeader } from "@/components/app/AppShell";
import { images, gifts, frames, entries, bubbles } from "@/components/app/data";
import { findUser, useProfile } from "@/components/app/profile";
import { Avatar, GenderChip, LevelChip, SpecialId, VipChip, UserBadges, UserName } from "@/components/app/ui";
import { useCloud } from '@/components/app/cloud';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute("/user/$id")({
  head: () => ({ meta: [{ title: "الملف الشخصي | صدى شات" }, { name: "description", content: "الملف الشخصي للعضو: المستوى والهدايا والزينات" }, { property: "og:title", content: "الملف الشخصي | صدى شات" }, { property: "og:description", content: "الملف الشخصي للعضو: المستوى والهدايا والزينات" }, { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: UserPage,
});

function UserPage() {
  const {data}=useCloud();
  const queryClient=useQueryClient();
  const { id } = Route.useParams();
  const p = useProfile();
  const u = findUser(id, p);
  if (!u) return <div><SubHeader title="الملف الشخصي" /><p className="p-6 text-center text-muted-foreground">المستخدم غير موجود</p></div>;
  const self = id === "me";
  const following = (data?.follows ?? []).some(f => f.follower_id === data?.profile?.id && f.following_id === u.id);
  const cloudItem = (value: string | null, kind: string) => value?.startsWith("cloud-") ? data?.catalog.find(item => item.id === value.slice(6) && item.kind === kind && item.enabled) : undefined;
  const cloudFrame = cloudItem(u.frame, "frame"), cloudEntry = cloudItem(u.entry, "entry"), cloudBubble = cloudItem(u.bubble, "bubble");
  const items = [
    cloudFrame?.url ? { l: "إطار", img: cloudFrame.url, n: cloudFrame.name } : u.frame && frames[u.frame] && { l: "إطار", img: frames[u.frame]?.img ?? '', n: frames[u.frame]?.n ?? '' },
    cloudEntry?.url ? { l: "دخولية", img: cloudEntry.url, n: cloudEntry.name } : u.entry && entries[u.entry] && { l: "دخولية", img: entries[u.entry]?.img ?? '', n: entries[u.entry]?.n ?? '' },
    cloudBubble?.url ? { l: "فقاعة", img: cloudBubble.url, n: cloudBubble.name } : u.bubble !== "none" && bubbles[u.bubble] && { l: "فقاعة", img: bubbles[u.bubble]?.img ?? '', n: bubbles[u.bubble]?.n ?? '' },
  ].filter((x): x is { l: string; img: string; n: string } => !!x);
  return (
    <div className="pb-20">
      <div className="relative h-[190px]">
        <img src={images.ice} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="relative"><SubHeader title="" transparent /></div>
      </div>
      <div className="-mt-20 flex flex-col items-center px-4 text-center">
        <Avatar img={u.avatar} frame={u.frame} size={96} className="mx-6 mb-6 mt-3" ring="border-2 border-secondary shadow-lg" />
        <h1 className="flex items-center gap-1 text-[19px] font-black text-navy"><UserName uid={u.uid} name={u.name}/><span className="text-[14px]">{u.flag}</span></h1>
        <button onClick={() => { navigator.clipboard?.writeText(u.sid ?? u.uid); toast("تم نسخ ID"); }} className="mt-1 flex items-center gap-1 text-navy"><SpecialId uid={u.uid} sid={u.sid} /><Copy className="h-3.5 w-3.5 opacity-60" /></button>
        <UserBadges userId={id==='me'?data?.profile?.id ?? '':u.id}/>
        <div className="mt-1.5 flex items-center gap-1"><GenderChip g={u.gender} /><LevelChip level={u.level} /><VipChip vip={u.vip} /></div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">{u.bio}</p>
      </div>
      <div className="space-y-3 px-3.5 pt-3">
        <div className="surface grid grid-cols-3 py-2 text-center">
          {[["المتابعون", u.fans], ["المتابَعون", u.following], ["الكاريزما", u.charm]].map(([l, n]) => <div key={l as string}><p className="text-[16px] font-black text-navy">{(n as number).toLocaleString("en")}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>)}
        </div>
        <div className="surface p-2.5">
          <p className="mb-2 text-[13px] font-extrabold text-navy">جدار الهدايا</p>
          <div className="grid grid-cols-4 gap-2">
            {u.gifts.map(([gi, c]) => <div key={gi} className="flex flex-col items-center rounded-xl bg-gradient-to-b from-accent/60 to-transparent py-1.5"><img src={gifts[gi]!.img} alt="" className="h-10 w-10" /><span className="text-[10.5px] font-bold text-navy">{gifts[gi]!.n}</span><span className="text-[10px] text-muted-foreground">×{c}</span></div>)}
          </div>
        </div>
        <div className="surface p-2.5">
          <p className="mb-2 text-[13px] font-extrabold text-navy">المقتنيات</p>
          {items.length ? <div className="grid grid-cols-3 gap-2">{items.map((d) => <div key={d.l} className="flex flex-col items-center rounded-xl bg-gradient-to-b from-accent/60 to-transparent py-1.5"><img src={d.img} alt="" className="h-11 w-14 object-contain" /><span className="text-[10px] text-muted-foreground">{d.l}</span><span className="w-full truncate px-1 text-[11px] font-bold text-navy">{d.n}</span></div>)}</div> : <p className="text-center text-[12px] text-muted-foreground">لا توجد مقتنيات بعد</p>}
        </div>
      </div>
      <div className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-[440px] -translate-x-1/2 grid-cols-3 gap-2 border-t bg-background/95 px-3 py-2.5 backdrop-blur">
        {self ? (
          <Link to="/me/edit" className="press col-span-3 flex items-center justify-center gap-1 rounded-full gold-bg py-2.5 text-[14px] font-black text-navy"><Pencil className="h-4 w-4" />تعديل الملف الشخصي</Link>
        ) : (
          <>
            <button onClick={async () => {
              if (!data?.profile?.id) { toast("سجّل الدخول أولاً"); return; }
              const request = following
                ? await (supabase as any).from("follows").delete().eq("follower_id", data.profile.id).eq("following_id", u.id)
                : await (supabase as any).from("follows").insert({ follower_id: data.profile.id, following_id: u.id });
              if (request.error) toast(request.error.message || "تعذّرت مزامنة المتابعة");
              else { await queryClient.invalidateQueries({ queryKey: ["cloud"] }); toast(following ? "تم إلغاء المتابعة" : "تمت المتابعة"); }
            }} className={`press flex items-center justify-center gap-1 rounded-full py-2.5 text-[13px] font-bold ${following ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"}`}>{following ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{following ? "متابَع" : "متابعة"}</button>
            <Link to="/messages" search={{ chat: id }} className="press flex items-center justify-center gap-1 rounded-full bg-secondary py-2.5 text-[13px] font-bold text-navy"><MessageCircle className="h-4 w-4" />رسالة</Link>
            <button onClick={() => toast("أرسل الهدية من داخل الغرفة")} className="press flex items-center justify-center gap-1 rounded-full gold-bg py-2.5 text-[13px] font-black text-navy"><GiftIcon className="h-4 w-4" />هدية</button>
          </>
        )}
      </div>
    </div>
  );
}
