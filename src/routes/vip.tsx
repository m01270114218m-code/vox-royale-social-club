import { createFileRoute, Link } from "@tanstack/react-router";
import { icons3d, vipBadge } from "@/lib/assets3d";
import { ArrowRight, Crown, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/vox";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route=createFileRoute("/vip")({component:()=> <AppShell><VipPage/></AppShell>});

const VIP = [
 { lv: 1, price: 1000, perks: "شارة VIP ولون اسم مميز" },
 { lv: 2, price: 3000, perks: "إطار صورة فضي" },
 { lv: 3, price: 8000, perks: "إطار ذهبي ودخول مميز للغرف" },
 { lv: 4, price: 20000, perks: "مركبة دخول وتأثير اسم" },
 { lv: 5, price: 50000, perks: "حماية من الطرد من الغرف العامة" },
 { lv: 6, price: 120000, perks: "تاج ملكي وأولوية الدعم" },
];

function VipPage(){
 const {user}=useAuth(); const [level,setLevel]=useState(0);
 useEffect(()=>{if(!user)return;void supabase.from("profiles").select("vip_level").eq("id",user.id).single().then(({data})=>setLevel(Number(data?.vip_level??0)));},[user]);
 async function buy(lv:number){
  const {data,error}=await supabase.rpc("buy_vip",{_level:lv});
  if(error){toast.error(error.message.includes("insufficient")?"رصيد العملات غير كافٍ":errMsg(error));return;}
  setLevel(lv); toast.success(`مبروك! أصبحت VIP ${lv} 👑`);
 }
 return <div dir="rtl" className="px-4 pt-5 pb-8">
  <div className="mb-4 flex items-center justify-between"><Link to="/profile" className="glass rounded-full p-2"><ArrowRight className="h-5 w-5"/></Link><h1 className="text-2xl font-black text-gold">VIP</h1><span/></div>
  <div className="card-3d glass rounded-3xl border border-gold/30 p-7 text-center shadow-gold">
   <Crown className="mx-auto h-20 w-20 text-gold drop-shadow-lg"/><div className="mt-2 text-sm text-muted-foreground">مستوى VIP الحالي</div><div className="text-5xl font-black text-gold">VIP {level}</div>
  </div>
  <div className="mt-4 grid grid-cols-2 gap-3">
   {VIP.map((v)=><div key={v.lv} className={`card-3d glass rounded-3xl p-4 text-center ${level>=v.lv?"ring-2 ring-primary":""}`}>
    <img src={vipBadge(v.lv)} alt={`وسام VIP ${v.lv}`} className="mx-auto h-24 w-24 object-contain"/>
    <div className="font-display text-2xl text-gold">VIP {v.lv}</div>
    <p className="min-h-10 text-xs text-muted-foreground">{v.perks}</p>
    <Button size="sm" className="mt-2 w-full bg-gold" disabled={level>=v.lv} onClick={()=>buy(v.lv)}>
      {level>=v.lv ? "مفعّل" : <><img src={icons3d.coin} alt="" className="h-5 w-5 object-contain"/>{v.price.toLocaleString()}</>}
    </Button>
   </div>)}
  </div>
  <div className="mt-4 glass rounded-2xl p-4"><Shield className="mb-2 h-6 w-6 text-primary"/><div className="font-bold">مزايا VIP</div><div className="mt-1 text-sm text-muted-foreground">جميع مستويات VIP وإدارتها أصبحت هنا، منفصلة عن المتجر العام.</div></div>
 </div>;
}