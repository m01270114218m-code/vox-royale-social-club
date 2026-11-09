import { createFileRoute, Link } from "@tanstack/react-router";
import { icons3d, vipBadge } from "@/lib/assets3d";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Crown, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/vox";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route=createFileRoute("/vip")({component:()=> <AppShell><VipPage/></AppShell>});

const VIP = [
 { lv: 1, name: "KNIGHT", price: 1000, accent: "#39e879", glow: "rgba(57,232,121,.28)", perks: ["شارة VIP", "هدايا Noble", "استرداد Diamond", "تأثيرات الدخول"] },
 { lv: 2, name: "LORD", price: 3000, accent: "#d8d8d8", glow: "rgba(220,220,220,.25)", perks: ["غطاء رأس حصري", "فقاعة Noble", "رقم مميز حصري", "Ride حصري"] },
 { lv: 3, name: "EARL", price: 8000, accent: "#ff8a3d", glow: "rgba(255,138,61,.28)", perks: ["Daimu حصري", "شعار حصري", "مظهر حصري", "الشخص الغامض"] },
 { lv: 4, name: "DUKE", price: 20000, accent: "#4f8cff", glow: "rgba(79,140,255,.30)", perks: ["شاشة بدء حصرية", "حماية من الطرد", "تأثير دخول متقدم", "هدايا Noble محسّنة"] },
 { lv: 5, name: "KING", price: 50000, accent: "#ffd42a", glow: "rgba(255,212,42,.32)", perks: ["الحماية من الكتم", "شارة ملكية حصرية", "مظهر ملكي متقدم", "أولوية مزايا VIP"] },
 { lv: 6, name: "VIP 6", price: 120000, accent: "#b978ff", glow: "rgba(185,120,255,.32)", perks: ["جميع مزايا VIP السابقة", "مزايا ملكية متقدمة", "تأثيرات دخول مميزة", "شارة VIP 6 حصرية"] },
];

function VipPage(){
 const {user}=useAuth();
 const [level,setLevel]=useState(0);
 const [selected,setSelected]=useState(1);

 useEffect(()=>{
  if(!user)return;
  void supabase.from("profiles").select("vip_level").eq("id",user.id).single().then(({data})=>{
   const current=Number(data?.vip_level??0);
   setLevel(current);
   setSelected(Math.min(6,Math.max(1,current||1)));
  });
 },[user]);

 const tier=useMemo(()=>VIP[selected-1],[selected]);

 async function buy(lv:number){
  const {error}=await supabase.rpc("buy_vip",{_level:lv});
  if(error){toast.error(error.message.includes("insufficient")?"رصيد العملات غير كافٍ":errMsg(error));return;}
  setLevel(lv);
  setSelected(lv);
  toast.success(`مبروك! أصبحت ${VIP[lv-1].name} 👑`);
 }

 const move=(dir:number)=>setSelected((v)=>Math.min(6,Math.max(1,v+dir)));

 return <div dir="rtl" className="min-h-full px-4 pt-4 pb-10" style={{background:"radial-gradient(circle at 50% 8%, "+tier.glow+", transparent 38%), linear-gradient(180deg,#080b12 0%,#05070b 100%)"}}>
  <div className="mb-4 flex items-center justify-between">
   <Link to="/profile" className="glass rounded-full p-2"><ArrowRight className="h-5 w-5"/></Link>
   <div className="text-center">
    <div className="text-xs font-bold tracking-[.3em] text-white/50">VIP ROYALE</div>
    <h1 className="text-2xl font-black" style={{color:tier.accent}}>مستويات VIP</h1>
   </div>
   <div className="w-9"/>
  </div>

  <div className="mb-3 flex items-center justify-center gap-1 overflow-hidden">
   <button onClick={()=>move(-1)} className="rounded-full p-2 text-white/70"><ChevronRight className="h-5 w-5"/></button>
   <div className="flex max-w-[290px] gap-1 overflow-hidden">
    {VIP.map((v)=><button key={v.lv} onClick={()=>setSelected(v.lv)} className="min-w-[76px] rounded-full px-2 py-2 text-[10px] font-bold transition-all" style={{color:selected===v.lv?v.accent:"rgba(255,255,255,.45)",background:selected===v.lv?"rgba(255,255,255,.08)":"transparent",border:selected===v.lv?"1px solid "+v.accent+"66":"1px solid transparent"}}>{v.name}</button>)}
   </div>
   <button onClick={()=>move(1)} className="rounded-full p-2 text-white/70"><ChevronLeft className="h-5 w-5"/></button>
  </div>

  <div className="relative overflow-hidden rounded-[28px] border p-4 shadow-2xl" style={{borderColor:tier.accent+"66",background:"linear-gradient(135deg,rgba(255,255,255,.10),rgba(0,0,0,.46))",boxShadow:"0 0 45px "+tier.glow}}>
   <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full blur-3xl" style={{background:tier.glow}}/>
   <div className="relative flex min-h-[210px] items-center justify-between gap-2">
    <div className="w-[48%] text-right">
     <div className="text-xs text-white/45">المستوى الحالي</div>
     <div className="mt-1 text-5xl font-black tracking-tight" style={{color:tier.accent}}>{tier.name}</div>
     <div className="mt-3 rounded-full border px-3 py-2 text-xs font-bold" style={{borderColor:tier.accent+"55",color:tier.accent,background:tier.glow}}>
      {level===tier.lv ? "مفعّل الآن" : level>tier.lv ? "مفتوح" : "غير مفعّل"}
     </div>
    </div>
    <div className="flex w-[52%] justify-center">
     <img src={vipBadge(tier.lv)} alt={`شارة ${tier.name}`} className="h-48 w-48 object-contain drop-shadow-2xl" />
    </div>
   </div>
   <div className="relative mt-2 text-right text-sm text-white/65">مستوى VIP ثلاثي الأبعاد متناسق مع هوية التطبيق ومزاياه.</div>
  </div>

  <div className="mt-4 overflow-hidden rounded-[26px] border" style={{borderColor:tier.accent+"44",background:"rgba(10,10,16,.72)"}}>
   <div className="px-4 py-3 text-center text-lg font-black" style={{color:tier.accent}}>✦ مميزات {tier.name} ✦</div>
   <div className="grid grid-cols-2 gap-2 p-3">
    {tier.perks.map((perk)=><div key={perk} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center" style={{borderColor:"rgba(255,255,255,.10)",background:"rgba(255,255,255,.035)"}}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full border" style={{borderColor:tier.accent+"55",background:tier.glow}}>
       <Check className="h-5 w-5" style={{color:tier.accent}}/>
      </div>
      <span className="text-xs font-bold text-white/85">{perk}</span>
    </div>)}
   </div>
  </div>

  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
   <div className="glass rounded-2xl p-3"><Crown className="mx-auto mb-1 h-6 w-6" style={{color:tier.accent}}/><div className="text-[11px] text-white/60">شارة حصرية</div></div>
   <div className="glass rounded-2xl p-3"><Sparkles className="mx-auto mb-1 h-6 w-6" style={{color:tier.accent}}/><div className="text-[11px] text-white/60">مزايا متدرجة</div></div>
   <div className="glass rounded-2xl p-3"><Shield className="mx-auto mb-1 h-6 w-6" style={{color:tier.accent}}/><div className="text-[11px] text-white/60">مزايا حماية</div></div>
  </div>

  <div className="mt-4 rounded-[24px] border p-4" style={{borderColor:tier.accent+"55",background:"linear-gradient(180deg,rgba(255,255,255,.08),rgba(0,0,0,.45))"}}>
   <div className="mb-3 flex items-center justify-between">
    <div><div className="text-xs text-white/45">سعر التفعيل</div><div className="mt-1 text-2xl font-black" style={{color:tier.accent}}>{tier.price.toLocaleString()} عملة</div></div>
    <img src={icons3d.coin} alt="" className="h-14 w-14 object-contain"/>
   </div>
   <Button className="w-full rounded-2xl py-6 text-base font-black" style={{background:tier.accent,color:"#111"}} disabled={level>=tier.lv} onClick={()=>buy(tier.lv)}>
    {level>=tier.lv ? "مفعّل" : `تفعيل ${tier.name} الآن`}
   </Button>
  </div>
 </div>;
}
