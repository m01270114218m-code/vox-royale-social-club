import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, Users, DoorOpen, Gift, Crown, Ban, BarChart3, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMsg } from "@/lib/vox";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "لوحة التحكم — VOX ROYALE" },
    { name: "description", content: "لوحة الإدارة الخارجية لمنصة VOX ROYALE." },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: () => <RequireAuth><AdminPage /></RequireAuth>,
});

type Tab = "overview" | "users" | "rooms" | "vip" | "gifts" | "bans";
const fmt = (d: string) => new Date(d).toLocaleString("ar-EG");

type Profile = {
  id: string; username: string | null; display_name: string | null; level: number;
  vip_level: number; country: string | null; created_at: string;
  wallet?: { coins: number; diamonds: number } | null; role?: string | null;
};
type Room = { id: string; owner_id: string; name: string; topic: string | null; country: string | null; join_mode: string; chat_enabled: boolean; gifts_enabled: boolean; created_at: string };
type Vip = { level: number; name: string; price_coins: number; duration_days: number };
type Gift = { id: string; name: string; emoji: string; price_coins: number; is_active: boolean };

function AdminPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      const { data, error } = await supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (!alive) return;
      if (error) { toast.error(errMsg(error)); setAllowed(false); return; }
      setRole(data?.role ?? null);
      setAllowed(data?.role === "admin" || data?.role === "moderator");
    })();
    return () => { alive = false; };
  }, [user, refresh]);

  if (allowed === null) return <div className="p-10 text-center text-muted-foreground">جارٍ التحقق من صلاحيات الإدارة…</div>;
  if (!allowed) return (
    <div className="mx-auto max-w-md p-6 pt-20 text-center">
      <Shield className="mx-auto h-14 w-14 text-primary" />
      <h1 className="mt-4 text-3xl font-bold text-primary">لوحة التحكم</h1>
      <p className="mt-2 text-sm text-muted-foreground">هذه الصفحة مخصصة للمشرفين فقط.</p>
      <Link to="/" className="mt-6 block text-sm text-muted-foreground">العودة للتطبيق</Link>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "نظرة عامة", icon: BarChart3 },
    { id: "users", label: "المستخدمون", icon: Users },
    { id: "rooms", label: "الغرف", icon: DoorOpen },
    { id: "vip", label: "VIP", icon: Crown },
    { id: "gifts", label: "الهدايا", icon: Gift },
    { id: "bans", label: "الحظر", icon: Ban },
  ];

  return <div className="mx-auto max-w-7xl p-4" dir="rtl">
    <header className="flex items-center justify-between gap-3 py-3">
      <div><h1 className="text-3xl font-bold text-primary">VOX ROYALE — لوحة الإدارة</h1><p className="text-xs text-muted-foreground">صلاحية: {role}</p></div>
      <div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setRefresh(v => v + 1)}><RefreshCw className="h-4 w-4" /></Button><Link to="/" className="rounded-lg px-3 py-2 text-sm text-muted-foreground">التطبيق</Link></div>
    </header>
    <nav className="flex gap-2 overflow-x-auto py-3">{tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === t.id ? "bg-primary text-primary-foreground" : "glass"}`}><t.icon className="h-4 w-4" />{t.label}</button>)}</nav>
    {tab === "overview" && <Overview refresh={refresh} />}
    {tab === "users" && <UsersTab refresh={refresh} />}
    {tab === "rooms" && <RoomsTab refresh={refresh} />}
    {tab === "vip" && <VipTab refresh={refresh} />}
    {tab === "gifts" && <GiftsTab refresh={refresh} />}
    {tab === "bans" && <BansTab refresh={refresh} />}
  </div>;
}

function Overview({ refresh }: { refresh: number }) {
  const [s, setS] = useState({ users: 0, rooms: 0, gifts: 0, vip: 0, members: 0, coins: 0 });
  useEffect(() => { (async () => {
    const [u,r,g,v,m,c] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("rooms").select("id", { count: "exact", head: true }),
      supabase.from("gifts").select("id", { count: "exact", head: true }),
      supabase.from("vip_tiers").select("level", { count: "exact", head: true }),
      supabase.from("room_members").select("user_id", { count: "exact", head: true }),
      supabase.from("wallet_balances").select("coins"),
    ]);
    setS({ users: u.count ?? 0, rooms: r.count ?? 0, gifts: g.count ?? 0, vip: v.count ?? 0, members: m.count ?? 0, coins: (c.data ?? []).reduce((n: number, x: { coins: number }) => n + Number(x.coins || 0), 0) });
  })(); }, [refresh]);
  const cards = [["المستخدمون",s.users],["الغرف",s.rooms],["أعضاء الغرف",s.members],["الهدايا",s.gifts],["مستويات VIP",s.vip],["إجمالي العملات",s.coins]];
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{cards.map(([l,v]) => <div key={String(l)} className="glass rounded-2xl p-4"><div className="text-2xl font-bold text-primary">{Number(v).toLocaleString()}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}</div>;
}

function UsersTab({ refresh }: { refresh: number }) {
  const [q,setQ]=useState(""); const [rows,setRows]=useState<Profile[]>([]);
  async function load() {
    let query = supabase.from("profiles").select("id,username,display_name,level,vip_level,country,created_at").order("created_at",{ascending:false}).limit(100);
    if (q.trim()) query = query.or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`);
    const {data,error}=await query; if(error){toast.error(errMsg(error));return;}
    const ids=(data??[]).map(x=>x.id);
    const {data: wallets}=ids.length ? await supabase.from("wallet_balances").select("user_id,coins,diamonds").in("user_id",ids) : {data:[] as any[]};
    const {data: roles}=ids.length ? await supabase.from("admin_roles").select("user_id,role").in("user_id",ids) : {data:[] as any[]};
    setRows((data??[]).map(p=>({...p,wallet:wallets?.find(w=>w.user_id===p.id)??null,role:roles?.find(r=>r.user_id===p.id)?.role??null})));
  }
  useEffect(()=>{load();},[refresh]);
  async function save(id:string, patch:Record<string,unknown>, msg:string){const {error}=await supabase.from("profiles").update(patch).eq("id",id);if(error)toast.error(errMsg(error));else{toast.success(msg);load();}}
  return <div className="space-y-3"><div className="flex gap-2"><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث بالاسم أو اسم المستخدم"/><Button onClick={load}>بحث</Button></div>{rows.map(u=><div key={u.id} className="glass rounded-2xl p-4 space-y-2"><div className="flex flex-wrap justify-between gap-2"><div><b>{u.display_name||u.username||"بدون اسم"}</b><div className="text-xs text-muted-foreground" dir="ltr">{u.id}</div></div><div className="text-xs">Lv {u.level} · VIP {u.vip_level} · 🪙 {Number(u.wallet?.coins??0).toLocaleString()} · {u.role??"user"}</div></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={()=>save(u.id,{vip_level:Math.max(0,u.vip_level+1)},"تم رفع VIP")}>VIP +</Button><Button size="sm" variant="outline" onClick={()=>save(u.id,{vip_level:Math.max(0,u.vip_level-1)},"تم خفض VIP")}>VIP -</Button><Button size="sm" variant="outline" onClick={()=>save(u.id,{level:Math.max(1,u.level+1)},"تم رفع المستوى")}>Level +</Button></div></div>)}</div>;
}

function RoomsTab({ refresh }: { refresh:number }) {
  const [rows,setRows]=useState<Room[]>([]); const [q,setQ]=useState("");
  async function load(){let query=supabase.from("rooms").select("id,owner_id,name,topic,country,join_mode,chat_enabled,gifts_enabled,created_at").order("created_at",{ascending:false}).limit(100);if(q.trim())query=query.ilike("name",`%${q.trim()}%`);const {data,error}=await query;if(error)toast.error(errMsg(error));else setRows(data??[]);}
  useEffect(()=>{load();},[refresh]);
  async function remove(id:string){if(!confirm("حذف الغرفة نهائياً؟"))return;const {error}=await supabase.from("rooms").delete().eq("id",id);if(error)toast.error(errMsg(error));else{toast.success("تم حذف الغرفة");load();}}
  async function toggle(id:string,field:"chat_enabled"|"gifts_enabled",value:boolean){const {error}=await supabase.from("rooms").update({[field]:!value}).eq("id",id);if(error)toast.error(errMsg(error));else load();}
  return <div className="space-y-3"><div className="flex gap-2"><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث باسم الغرفة"/><Button onClick={load}>بحث</Button></div>{rows.map(r=><div key={r.id} className="glass rounded-2xl p-4"><div className="flex justify-between gap-2"><div><b>{r.name}</b><p className="text-xs text-muted-foreground">{r.topic||"بدون موضوع"} · {r.join_mode} · {fmt(r.created_at)}</p></div><Button size="sm" variant="destructive" onClick={()=>remove(r.id)}>حذف</Button></div><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={()=>toggle(r.id,"chat_enabled",r.chat_enabled)}>الدردشة: {r.chat_enabled?"مفعلة":"مغلقة"}</Button><Button size="sm" variant="outline" onClick={()=>toggle(r.id,"gifts_enabled",r.gifts_enabled)}>الهدايا: {r.gifts_enabled?"مفعلة":"مغلقة"}</Button><Link to="/room/$id" params={{id:r.id}} className="rounded-md border px-3 py-1.5 text-sm">فتح</Link></div></div>)}</div>;
}

function VipTab({ refresh }: { refresh:number }) {
  const [rows,setRows]=useState<Vip[]>([]);
  async function load(){const {data,error}=await supabase.from("vip_tiers").select("level,name,price_coins,duration_days").order("level");if(error)toast.error(errMsg(error));else setRows(data??[]);}
  useEffect(()=>{load();},[refresh]);
  return <div className="space-y-2">{rows.map(v=><div key={v.level} className="glass flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4"><div><b>VIP {v.level} — {v.name}</b><div className="text-xs text-muted-foreground">{v.duration_days} يوم</div></div><Input className="w-36" type="number" value={v.price_coins} onChange={e=>setRows(rs=>rs.map(x=>x.level===v.level?{...x,price_coins:Number(e.target.value)}:x))}/><Button size="sm" onClick={async()=>{const {error}=await supabase.from("vip_tiers").update({price_coins:v.price_coins}).eq("level",v.level);if(error)toast.error(errMsg(error));else toast.success("تم حفظ السعر")}}>حفظ</Button></div>)}</div>;
}

function GiftsTab({ refresh }: { refresh:number }) {
  const [rows,setRows]=useState<Gift[]>([]);
  async function load(){const {data,error}=await supabase.from("gifts").select("id,name,emoji,price_coins,is_active").order("name");if(error)toast.error(errMsg(error));else setRows(data??[]);}
  useEffect(()=>{load();},[refresh]);
  return <div className="space-y-2">{rows.map(g=><div key={g.id} className="glass flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4"><div className="min-w-40"><b>{g.emoji} {g.name}</b><div className="text-xs text-muted-foreground" dir="ltr">{g.id}</div></div><Input className="w-32" type="number" value={g.price_coins} onChange={e=>setRows(rs=>rs.map(x=>x.id===g.id?{...x,price_coins:Number(e.target.value)}:x))}/><Button size="sm" variant={g.is_active?"destructive":"default"} onClick={async()=>{const {error}=await supabase.from("gifts").update({is_active:!g.is_active,price_coins:g.price_coins}).eq("id",g.id);if(error)toast.error(errMsg(error));else{toast.success("تم تحديث الهدية");load();}}}>{g.is_active?"تعطيل":"تفعيل"}</Button></div>)}</div>;
}

function BansTab({ refresh }: { refresh:number }) {
  const [rows,setRows]=useState<{user_id:string;reason:string|null;banned_until:string|null;created_at:string}[]>([]);
  async function load(){const {data,error}=await supabase.from("user_bans").select("user_id,reason,banned_until,created_at").order("created_at",{ascending:false});if(error)toast.error(errMsg(error));else setRows(data??[]);}
  useEffect(()=>{load();},[refresh]);
  async function unban(id:string){const {error}=await supabase.from("user_bans").delete().eq("user_id",id);if(error)toast.error(errMsg(error));else{toast.success("تم إلغاء الحظر");load();}}
  return <div className="space-y-2">{rows.length===0&&<div className="glass rounded-2xl p-6 text-center text-muted-foreground">لا يوجد مستخدمون محظورون</div>}{rows.map(b=><div key={b.user_id} className="glass flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4"><div><b dir="ltr">{b.user_id}</b><div className="text-xs text-muted-foreground">{b.reason||"بدون سبب"} · {b.banned_until?fmt(b.banned_until):"دائم"}</div></div><Button size="sm" onClick={()=>unban(b.user_id)}>إلغاء الحظر</Button></div>)}</div>;
}
