import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAsset } from "@/lib/media";
import { toast } from "sonner";
import { errMsg } from "@/lib/vox";

export const Route = createFileRoute("/bag")({ component: () => <AppShell><BagPage/></AppShell> });

type Item={id:string;item_id:string;acquired_at:string;store_items:{name:string;kind:string;asset_key:string}|null};
type Badge={id:string;badge_key:string;badge_name:string;badge_asset_key:string|null;badge_color:string;is_equipped:boolean};

function Asset({item,equipped,onToggle}:{item:Item;equipped:boolean;onToggle:()=>void}) {
  const src=useAdminAsset(item.store_items?.asset_key ?? undefined);
  const name=item.store_items?.name ?? "عنصر";
  const kind=item.store_items?.kind === "frame" ? "إطار" : item.store_items?.kind === "entry" ? "دخولية" : item.store_items?.kind === "bubble" ? "فقاعة كتابة" : item.store_items?.kind === "sound_wave" ? "موجة صوت" : item.store_items?.kind === "profile_card" ? "بطاقة تعريف" : item.store_items?.kind ?? "عنصر";
  return <div className="card-3d glass rounded-2xl p-3"><div className="h-24 overflow-hidden rounded-xl bg-background/60">{src&&<img src={src} alt="" className="h-full w-full object-contain"/>}</div><div className="mt-2 truncate font-bold">{name}</div><div className="text-xs text-muted-foreground">{kind}</div><button onClick={onToggle} className={equipped?"mt-2 w-full rounded-xl bg-gold px-3 py-2 text-sm font-bold text-black":"mt-2 w-full rounded-xl border border-primary/30 px-3 py-2 text-sm font-bold"}>{equipped?<><Check className="mr-1 inline h-4 w-4"/>مفعل</>:<><X className="mr-1 inline h-4 w-4"/>تفعيل</>}</button></div>;
}

function BagPage(){
 const {user}=useAuth(); const [items,setItems]=useState<Item[]>([]); const [badges,setBadges]=useState<Badge[]>([]); const [p,setP]=useState<{equipped_frame:string|null;equipped_entry:string|null;chat_bubble_asset_key:string|null;sound_wave_asset_key:string|null;profile_card_asset_key:string|null}>({equipped_frame:null,equipped_entry:null,chat_bubble_asset_key:null,sound_wave_asset_key:null,profile_card_asset_key:null});
 async function load(){if(!user)return; const [{data:i},{data:b},{data:pr}]=await Promise.all([supabase.from("user_items").select("id,item_id,acquired_at,store_items(name,kind,asset_key)").eq("user_id",user.id).order("acquired_at",{ascending:false}),supabase.from("user_badges").select("id,badge_key,badge_name,badge_asset_key,badge_color,is_equipped").eq("user_id",user.id),supabase.from("profiles").select("equipped_frame,equipped_entry,chat_bubble_asset_key,sound_wave_asset_key,profile_card_asset_key").eq("id",user.id).single()]); setItems((i??[]) as unknown as Item[]);setBadges((b??[]) as Badge[]);if(pr)setP(pr);}
 useEffect(()=>{void load()},[user]);
 async function toggle(item:Item){if(!item.store_items)return; const equipped=item.store_items.kind==="frame"?p.equipped_frame===item.store_items.asset_key:item.store_items.kind==="entry"?p.equipped_entry===item.store_items.asset_key:item.store_items.kind==="bubble"?p.chat_bubble_asset_key===item.store_items.asset_key:item.store_items.kind==="sound_wave"?p.sound_wave_asset_key===item.store_items.asset_key:item.store_items.kind==="profile_card"?p.profile_card_asset_key===item.store_items.asset_key:false;if(equipped && !["frame","entry"].includes(item.store_items.kind)){return;} const {error}=await supabase.rpc("equip_item",{_item_id:item.item_id,_equip:!equipped});if(error){toast.error(errMsg(error));return;}await load();toast.success(!equipped?"تم التفعيل":"تم الإيقاف");}
 async function badgeToggle(b:Badge){const {error}=await supabase.rpc("equip_badge",{_badge:b.id,_equip:!b.is_equipped});if(error){toast.error(errMsg(error));return;}await load();}
 return <div dir="rtl" className="px-4 pt-5 pb-8"><div className="mb-4 flex items-center justify-between"><Link to="/profile" className="glass rounded-full p-2"><ArrowRight className="h-5 w-5"/></Link><h1 className="text-2xl font-black text-gold">حقيبتي</h1><span/></div><p className="mb-4 text-sm text-muted-foreground">كل ما تملكه من إطارات ودخوليات وشارات. يمكنك تفعيل أو إيقاف العنصر من هنا.</p><div className="grid grid-cols-2 gap-3">{items.map(i=><Asset key={i.id} item={i} equipped={i.store_items?.kind==="frame"?p.equipped_frame===i.store_items.asset_key:i.store_items?.kind==="entry"?p.equipped_entry===i.store_items.asset_key:i.store_items?.kind==="bubble"?p.chat_bubble_asset_key===i.store_items.asset_key:i.store_items?.kind==="sound_wave"?p.sound_wave_asset_key===i.store_items.asset_key:i.store_items?.kind==="profile_card"?p.profile_card_asset_key===i.store_items.asset_key:false} onToggle={()=>void toggle(i)}/>)}</div>{badges.length>0&&<section className="glass mt-4 rounded-3xl p-4"><div className="mb-3 font-bold">الشارات</div><div className="grid grid-cols-2 gap-2">{badges.map(b=><button key={b.id} onClick={()=>void badgeToggle(b)} className="rounded-2xl border p-3 text-right" style={{borderColor:b.badge_color}}><div className="font-bold">{b.badge_name}</div><div className="text-xs text-muted-foreground">{b.is_equipped?"مفعلة":"متوقفة"}</div></button>)}</div></section>}</div>
}
