import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Crown, Shield, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route=createFileRoute("/vip")({component:()=> <AppShell><VipPage/></AppShell>});

function VipPage(){
 const {user}=useAuth(); const [level,setLevel]=useState(0);
 useEffect(()=>{if(!user)return;void supabase.from("profiles").select("vip_level").eq("id",user.id).single().then(({data})=>setLevel(Number(data?.vip_level??0)));},[user]);
 return <div dir="rtl" className="px-4 pt-5 pb-8">
  <div className="mb-4 flex items-center justify-between"><Link to="/profile" className="glass rounded-full p-2"><ArrowRight className="h-5 w-5"/></Link><h1 className="text-2xl font-black text-gold">VIP</h1><span/></div>
  <div className="card-3d glass rounded-3xl border border-gold/30 p-7 text-center shadow-gold">
   <Crown className="mx-auto h-20 w-20 text-gold drop-shadow-lg"/><div className="mt-2 text-sm text-muted-foreground">مستوى VIP الحالي</div><div className="text-5xl font-black text-gold">VIP {level}</div>
  </div>
  <div className="mt-4 grid gap-3">
   <div className="glass rounded-2xl p-4"><Shield className="mb-2 h-6 w-6 text-primary"/><div className="font-bold">مزايا VIP</div><div className="mt-1 text-sm text-muted-foreground">تظهر المزايا الفعلية المرتبطة بمستواك الحالي دون إضافة بيانات تجريبية.</div></div>
   <div className="glass rounded-2xl p-4"><Sparkles className="mb-2 h-6 w-6 text-gold"/><div className="font-bold">إدارة VIP</div><div className="mt-1 text-sm text-muted-foreground">تبقى عناصر VIP منفصلة عن المتجر العام.</div></div>
  </div>
 </div>;
}