import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, BarChart3, Bell, Boxes, Building2, Check, Crown, DoorOpen, FileText,
  Gift, History, LayoutDashboard, Megaphone, RefreshCw, Save, Search, Settings,
  Shield, SlidersHorizontal, Users, Wallet, Volume2, VolumeX, Lock, Unlock, Trash2,
  UserCog, Ban, Eye, Plus, X
} from "lucide-react";
import { toast } from "sonner";
import { supabase, type Json } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMsg } from "@/lib/vox";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "VOX ROYALE — Admin Control Center" },
    { name: "description", content: "External administration dashboard for VOX ROYALE." },
    { name: "robots", content: "noindex,nofollow" },
  ]}),
  component: () => <RequireAuth><AdminPage /></RequireAuth>,
});

type Tab = "dashboard"|"users"|"rooms"|"seats"|"vip"|"wallet"|"gifts"|"banners"|"notifications"|"assets"|"reports"|"roles"|"settings"|"analytics"|"audit";
type Profile = { id:string; username:string|null; display_name:string|null; level:number; vip_level:number; country:string|null; created_at:string };
const fmt=(d:string)=>new Date(d).toLocaleString("ar-EG");
const card="rounded-2xl border border-white/10 bg-white/[.04] backdrop-blur";
const input="bg-black/20 border-white/10";

function AdminPage(){
  const {user}=useAuth();
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [role,setRole]=useState<string|null>(null);
  const [tab,setTab]=useState<Tab>("dashboard");
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{let ok=true;(async()=>{
    if(!user)return;
    const {data,error}=await supabase.from("admin_roles").select("role").eq("user_id",user.id).maybeSingle();
    if(!ok)return;
    if(error){toast.error(errMsg(error));setAllowed(false);return}
    setRole(data?.role??null);setAllowed(data?.role==="admin"||data?.role==="moderator");
  })();return()=>{ok=false}},[user,refresh]);

  if(allowed===null)return <div className="min-h-screen grid place-items-center text-muted-foreground" dir="rtl">جارٍ التحقق من صلاحيات الإدارة…</div>;
  if(!allowed)return <div className="min-h-screen grid place-items-center p-6 text-center" dir="rtl"><div className={card+" p-10 max-w-md"}><Shield className="mx-auto h-14 w-14 text-primary"/><h1 className="mt-4 text-3xl font-bold">Admin Control Center</h1><p className="mt-2 text-muted-foreground">هذه المنطقة للمشرفين فقط.</p><Link to="/" className="mt-6 inline-block text-primary">العودة للتطبيق</Link></div></div>;

  const tabs:{id:Tab;label:string;icon:any}[]=[
    ["dashboard","Dashboard",LayoutDashboard],["users","Users",Users],["rooms","Rooms",DoorOpen],["seats","Seats",Volume2],
    ["vip","VIP",Crown],["wallet","Wallet",Wallet],["gifts","Gifts",Gift],["banners","Banners",Megaphone],
    ["notifications","Notifications",Bell],["assets","3D Assets",Boxes],["reports","Reports",FileText],
    ["roles","Admin Roles",UserCog],["settings","Settings",Settings],["analytics","Analytics",BarChart3],["audit","Audit Log",History]
  ].map(([id,label,icon])=>({id:id as Tab,label:label as string,icon}));
  return <div dir="rtl" className="min-h-screen bg-background">
    <div className="sticky top-0 z-30 border-b border-white/10 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4">
        <header className="flex items-center justify-between gap-4 py-4">
          <div><div className="flex items-center gap-2"><Shield className="h-7 w-7 text-primary"/><h1 className="text-2xl font-black tracking-tight">VOX ROYALE</h1><span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] text-primary">ADMIN</span></div><p className="text-xs text-muted-foreground">External Control Center · {role}</p></div>
          <div className="flex gap-2"><Button variant="outline" size="icon" onClick={()=>setRefresh(v=>v+1)} title="تحديث"><RefreshCw className="h-4 w-4"/></Button><Link to="/" className="rounded-lg border px-3 py-2 text-sm">التطبيق</Link></div>
        </header>
        <nav className="flex gap-1 overflow-x-auto pb-3">{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${tab===t.id?"bg-primary text-primary-foreground":"bg-white/[.03] text-muted-foreground hover:bg-white/[.07]"}`}><t.icon className="h-4 w-4"/>{t.label}</button>)}</nav>
      </div>
    </div>
    <main className="mx-auto max-w-[1600px] p-4 md:p-6">
      {tab==="dashboard"&&<Dashboard refresh={refresh}/>}
      {tab==="users"&&<UsersTab refresh={refresh}/>}
      {tab==="rooms"&&<RoomsTab refresh={refresh}/>}
      {tab==="seats"&&<SeatsTab refresh={refresh}/>}
      {tab==="vip"&&<VipTab refresh={refresh}/>}
      {tab==="wallet"&&<WalletTab refresh={refresh}/>}
      {tab==="gifts"&&<GiftsTab refresh={refresh}/>}
      {tab==="banners"&&<BannersTab refresh={refresh}/>}
      {tab==="notifications"&&<NotificationsTab refresh={refresh}/>}
      {tab==="assets"&&<AssetsTab refresh={refresh}/>}
      {tab==="reports"&&<ReportsTab refresh={refresh}/>}
      {tab==="roles"&&<RolesTab refresh={refresh}/>}
      {tab==="settings"&&<SettingsTab refresh={refresh}/>}
      {tab==="analytics"&&<AnalyticsTab refresh={refresh}/>}
      {tab==="audit"&&<AuditTab refresh={refresh}/>}
    </main>
  </div>
}

function Section({title,icon:Icon,children,action}:{title:string;icon:any;children:ReactNode;action?:ReactNode}){
 return <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><Icon className="h-5 w-5 text-primary"/>{title}</h2>{action}</div>{children}</section>
}
function Empty({text="لا توجد بيانات"}:{text?:string}){return <div className={card+" p-8 text-center text-sm text-muted-foreground"}>{text}</div>}
function Stat({label,value,icon:Icon}:{label:string;value:string|number;icon:any}){return <div className={card+" p-5"}><Icon className="h-5 w-5 text-primary"/><div className="mt-3 text-2xl font-black">{typeof value==="number"?value.toLocaleString():value}</div><div className="text-xs text-muted-foreground">{label}</div></div>}
async function audit(action:string,type?:string,id?:string,details?:Json){await supabase.rpc("admin_write_audit",{p_action:action,p_entity_type:type??null,p_entity_id:id??null,p_details:details??{}})}

function Dashboard({refresh}:{refresh:number}){
 const [s,setS]=useState({users:0,rooms:0,members:0,seats:0,coins:0,gifts:0,bans:0,reports:0});
 useEffect(()=>{(async()=>{
  const [u,r,m,se,w,g,b,rep]=await Promise.all([
   supabase.from("profiles").select("id",{count:"exact",head:true}),supabase.from("rooms").select("id",{count:"exact",head:true}),
   supabase.from("room_members").select("user_id",{count:"exact",head:true}),supabase.from("room_seats").select("room_id",{count:"exact",head:true}),
   supabase.from("wallet_balances").select("coins"),supabase.from("gifts").select("id",{count:"exact",head:true}),
   supabase.from("user_bans").select("user_id",{count:"exact",head:true}),supabase.from("admin_reports").select("id",{count:"exact",head:true})
  ]);
  setS({users:u.count??0,rooms:r.count??0,members:m.count??0,seats:se.count??0,coins:(w.data??[]).reduce((n,x)=>n+Number(x.coins||0),0),gifts:g.count??0,bans:b.count??0,reports:rep.count??0});
 })()},[refresh]);
 return <div className="space-y-6"><div><h2 className="text-3xl font-black">Dashboard</h2><p className="text-sm text-muted-foreground">مركز التحكم الكامل في VOX ROYALE.</p></div>
 <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8"><Stat label="Users" value={s.users} icon={Users}/><Stat label="Rooms" value={s.rooms} icon={DoorOpen}/><Stat label="Room members" value={s.members} icon={Activity}/><Stat label="Seats" value={s.seats} icon={Volume2}/><Stat label="Coins" value={s.coins} icon={Wallet}/><Stat label="Gifts" value={s.gifts} icon={Gift}/><Stat label="Bans" value={s.bans} icon={Ban}/><Stat label="Reports" value={s.reports} icon={FileText}/></div>
 <div className="grid gap-4 md:grid-cols-3"><div className={card+" p-5"}><h3 className="font-bold">تشغيل سريع</h3><div className="mt-3 grid grid-cols-2 gap-2"><Quick label="Users" onClick={()=>{}} icon={Users}/><Quick label="Rooms" onClick={()=>{}} icon={DoorOpen}/><Quick label="Wallet" onClick={()=>{}} icon={Wallet}/><Quick label="Reports" onClick={()=>{}} icon={FileText}/></div></div><div className={card+" p-5 md:col-span-2"><h3 className="font-bold">نطاق التحكم</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">المستخدمون، الغرف والمقاعد، VIP، المحافظ والمعاملات، الهدايا، البانرات، الإشعارات، مكتبة الأصول 3D، البلاغات، الأدوار، الإعدادات، التحليلات وسجل التدقيق—all connected to Supabase.</p></div></div>
 </div>
}
function Quick({label,onClick,icon:Icon}:{label:string;onClick:()=>void;icon:any}){return <button onClick={onClick} className="rounded-xl border border-white/10 p-3 text-right text-xs hover:bg-white/[.05]"><Icon className="h-4 w-4 text-primary"/><span className="mt-2 block">{label}</span></button>}

function UsersTab({refresh}:{refresh:number}){
 const [q,setQ]=useState("");const [rows,setRows]=useState<Profile[]>([]);const load=async()=>{
  let x=supabase.from("profiles").select("id,username,display_name,level,vip_level,country,created_at").order("created_at",{ascending:false}).limit(100);
  if(q.trim())x=x.or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`);
  const {data,error}=await x;if(error)return toast.error(errMsg(error));setRows(data??[]);
 };
 useEffect(()=>{load()},[refresh]);
 const update=async(id:string,patch:Record<string,unknown>,msg:string)=>{const {error}=await supabase.from("profiles").update(patch).eq("id",id);if(error)toast.error(errMsg(error));else{await audit(msg,"user",id,patch);toast.success("تم الحفظ");load()}};
 const ban=async(id:string)=>{const reason=prompt("سبب الحظر","مخالفة قوانين المجتمع")||"إجراء إداري";const {error}=await supabase.from("user_bans").upsert({user_id:id,reason,created_by:(await supabase.auth.getUser()).data.user?.id});if(error)toast.error(errMsg(error));else{await audit("ban","user",id,{reason});toast.success("تم الحظر")}};
 return <Section title="Users" icon={Users} action={<div className="flex gap-2"><Input className={input+" w-64"} value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث بالاسم…"/><Button onClick={load}><Search className="h-4 w-4"/></Button></div>}>
  <div className="space-y-2">{rows.map(u=><div key={u.id} className={card+" p-4"}><div className="flex flex-wrap items-center justify-between gap-3"><div><b>{u.display_name||u.username||"بدون اسم"}</b><div className="text-xs text-muted-foreground" dir="ltr">{u.id}</div><div className="text-xs text-muted-foreground">{u.country||"—"} · {fmt(u.created_at)}</div></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/5 px-3 py-1 text-xs">Lv {u.level}</span><span className="rounded-full bg-primary/10 px-3 py-1 text-xs">VIP {u.vip_level}</span><Button size="sm" onClick={()=>update(u.id,{vip_level:u.vip_level+1},"vip_up")}>VIP +</Button><Button size="sm" variant="outline" onClick={()=>update(u.id,{level:u.level+1},"level_up")}>Level +</Button><Button size="sm" variant="destructive" onClick={()=>ban(u.id)}><Ban className="h-4 w-4"/></Button></div></div></div>)}</div>
 </Section>
}

function RoomsTab({refresh}:{refresh:number}){
 const [q,setQ]=useState("");const [rows,setRows]=useState<any[]>([]);
 const load=async()=>{let x=supabase.from("rooms").select("id,owner_id,name,topic,country,join_mode,chat_enabled,gifts_enabled,created_at").order("created_at",{ascending:false}).limit(100);if(q.trim())x=x.ilike("name",`%${q.trim()}%`);const {data,error}=await x;if(error)toast.error(errMsg(error));else setRows(data??[])};
 useEffect(()=>{load()},[refresh]);
 const toggle=async(r:any,k:string)=>{const {error}=await supabase.from("rooms").update({[k]:!r[k]}).eq("id",r.id);if(error)toast.error(errMsg(error));else{await audit("room_toggle","room",r.id,{field:k,value:!r[k]});load()}};
 const remove=async(id:string)=>{if(!confirm("حذف الغرفة؟"))return;const {error}=await supabase.from("rooms").delete().eq("id",id);if(error)toast.error(errMsg(error));else{await audit("room_delete","room",id);toast.success("تم حذف الغرفة");load()}};
 return <Section title="Rooms" icon={DoorOpen} action={<div className="flex gap-2"><Input className={input+" w-64"} value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث عن غرفة…"/><Button onClick={load}><Search className="h-4 w-4"/></Button></div>}><div className="space-y-2">{rows.map(r=><div key={r.id} className={card+" p-4"}><div className="flex flex-wrap justify-between gap-3"><div><b>{r.name}</b><div className="text-xs text-muted-foreground">{r.topic||"بدون موضوع"} · {r.country||"—"} · {r.join_mode}</div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>toggle(r,"chat_enabled")}>Chat {r.chat_enabled?"ON":"OFF"}</Button><Button size="sm" variant="outline" onClick={()=>toggle(r,"gifts_enabled")}>Gifts {r.gifts_enabled?"ON":"OFF"}</Button><Link to="/room/$id" params={{id:r.id}} className="rounded-md border px-3 py-1.5 text-sm"><Eye className="inline h-4 w-4"/> فتح</Link><Button size="sm" variant="destructive" onClick={()=>remove(r.id)}><Trash2 className="h-4 w-4"/></Button></div></div></div>)}</div></Section>
}

function SeatsTab({refresh}:{refresh:number}){
 const [rooms,setRooms]=useState<any[]>([]);const [room,setRoom]=useState("");const [seats,setSeats]=useState<any[]>([]);
 useEffect(()=>{supabase.from("rooms").select("id,name").order("created_at",{ascending:false}).limit(100).then(({data})=>{setRooms(data??[]);if(!room&&data?.[0])setRoom(data[0].id)})},[refresh]);
 useEffect(()=>{if(!room)return;supabase.from("room_seats").select("room_id,seat_number,user_id,is_locked,is_muted").eq("room_id",room).order("seat_number").then(({data,error})=>{if(error)toast.error(errMsg(error));else setSeats(data??[])})},[room,refresh]);
 const act=async(seat:any,patch:any)=>{const {error}=await supabase.from("room_seats").update(patch).eq("room_id",seat.room_id).eq("seat_number",seat.seat_number);if(error)toast.error(errMsg(error));else{await audit("seat_update","seat",`${seat.room_id}:${seat.seat_number}`,patch);setSeats(s=>s.map(x=>x.seat_number===seat.seat_number?{...x,...patch}:x))}};
 return <Section title="Seats — إدارة المقاعد" icon={Volume2} action={<select className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm" value={room} onChange={e=>setRoom(e.target.value)}>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{seats.map(s=><div key={s.seat_number} className={card+" p-4"}><div className="flex items-center justify-between"><b>Seat {s.seat_number}</b>{s.user_id?<span className="text-xs text-primary">مشغول</span>:<span className="text-xs text-muted-foreground">فارغ</span>}</div><div className="mt-2 text-[11px] text-muted-foreground" dir="ltr">{s.user_id||"—"}</div><div className="mt-3 flex flex-wrap gap-2">{s.user_id&&<Button size="sm" variant="outline" onClick={()=>act(s,{is_muted:!s.is_muted})}>{s.is_muted?<Volume2/>:<VolumeX/>} {s.is_muted?"Unmute":"Mute"}</Button>}<Button size="sm" variant="outline" onClick={()=>act(s,{is_locked:!s.is_locked})}>{s.is_locked?<Unlock/>:<Lock/>} {s.is_locked?"Unlock":"Lock"}</Button></div></div>)}</div>{!seats.length&&<Empty text="لا توجد مقاعد لهذه الغرفة"/></Section>
}

function VipTab({refresh}:{refresh:number}){
 const [rows,setRows]=useState<any[]>([]);const load=async()=>{const {data,error}=await supabase.from("vip_tiers").select("level,name,price_coins,duration_days").order("level");if(error)toast.error(errMsg(error));else setRows(data??[])};useEffect(()=>{load()},[refresh]);
 return <Section title="VIP — المستويات والمزايا" icon={Crown}><div className="grid gap-3 md:grid-cols-2">{rows.map(v=><div key={v.level} className={card+" p-4"}><div className="flex items-center justify-between"><div><b>VIP {v.level} · {v.name}</b><div className="text-xs text-muted-foreground">{v.duration_days} يوم</div></div><Crown className="h-5 w-5 text-primary"/></div><div className="mt-4 flex gap-2"><Input className={input} type="number" value={v.price_coins} onChange={e=>setRows(rs=>rs.map(x=>x.level===v.level?{...x,price_coins:Number(e.target.value)}:x))}/><Button onClick={async()=>{const {error}=await supabase.from("vip_tiers").update({price_coins:v.price_coins}).eq("level",v.level);if(error)toast.error(errMsg(error));else{await audit("vip_price_update","vip",String(v.level),{price:v.price_coins});toast.success("تم الحفظ")}}}><Save className="h-4 w-4"/></Button></div></div>)}</div></Section>
}

function WalletTab({refresh}:{refresh:number}){
 const [q,setQ]=useState("");const [rows,setRows]=useState<any[]>([]);const load=async()=>{let x=supabase.from("wallet_balances").select("user_id,coins,diamonds,updated_at").order("updated_at",{ascending:false}).limit(100);if(q.trim())x=x.eq("user_id",q.trim());const {data,error}=await x;if(error)toast.error(errMsg(error));else setRows(data??[])};useEffect(()=>{load()},[refresh]);
 const save=async(r:any,coins:number,diamonds:number)=>{const {error}=await supabase.from("wallet_balances").update({coins:Math.max(0,coins),diamonds:Math.max(0,diamonds)}).eq("user_id",r.user_id);if(error)toast.error(errMsg(error));else{await audit("wallet_adjust","wallet",r.user_id,{coins,diamonds});toast.success("تم تحديث المحفظة");load()}};
 return <Section title="Wallet — المحافظ" icon={Wallet} action={<div className="flex gap-2"><Input className={input+" w-72"} value={q} onChange={e=>setQ(e.target.value)} placeholder="User UUID للتصفية"/><Button onClick={load}><Search className="h-4 w-4"/></Button></div>}><div className="space-y-2">{rows.map(r=><div key={r.user_id} className={card+" p-4"}><div className="text-xs text-muted-foreground" dir="ltr">{r.user_id}</div><div className="mt-2 grid grid-cols-2 gap-2 md:max-w-md"><label className="text-xs">Coins<Input className={input} type="number" defaultValue={r.coins} id={`c-${r.user_id}`}/></label><label className="text-xs">Diamonds<Input className={input} type="number" defaultValue={r.diamonds} id={`d-${r.user_id}`}/></label></div><Button className="mt-3" size="sm" onClick={()=>save(r,Number((document.getElementById(`c-${r.user_id}`) as HTMLInputElement).value),Number((document.getElementById(`d-${r.user_id}`) as HTMLInputElement).value))}>حفظ</Button></div>)}</div></Section>
}

function GiftsTab({refresh}:{refresh:number}){
 const [rows,setRows]=useState<any[]>([]);const load=async()=>{const {data,error}=await supabase.from("gifts").select("id,name,emoji,price_coins,is_active").order("name");if(error)toast.error(errMsg(error));else setRows(data??[])};useEffect(()=>{load()},[refresh]);
 return <Section title="Gifts — الهدايا" icon={Gift}><div className="grid gap-3 md:grid-cols-2">{rows.map(g=><div key={g.id} className={card+" p-4"}><div className="flex justify-between"><b>{g.emoji} {g.name}</b><span className="text-xs text-muted-foreground">{g.is_active?"Active":"Disabled"}</span></div><div className="mt-3 flex gap-2"><Input className={input} type="number" value={g.price_coins} onChange={e=>setRows(rs=>rs.map(x=>x.id===g.id?{...x,price_coins:Number(e.target.value)}:x))}/><Button onClick={async()=>{const {error}=await supabase.from("gifts").update({price_coins:g.price_coins}).eq("id",g.id);if(error)toast.error(errMsg(error));else{await audit("gift_update","gift",g.id,{price:g.price_coins});toast.success("تم الحفظ")}}}>حفظ</Button><Button variant={g.is_active?"destructive":"default"} onClick={async()=>{const {error}=await supabase.from("gifts").update({is_active:!g.is_active}).eq("id",g.id);if(error)toast.error(errMsg(error));else load()}}>{g.is_active?"تعطيل":"تفعيل"}</Button></div></div>)}</div></Section>
}

function BannersTab({refresh}:{refresh:number}){
 const [rows,setRows]=useState<any[]>([]);const [form,setForm]=useState({title:"",body:"",image_url:"",action_url:""});
 const load=async()=>{const {data,error}=await supabase.from("admin_banners").select("*").order("created_at",{ascending:false});if(error)toast.error(errMsg(error));else setRows(data??[])};useEffect(()=>{load()},[refresh]);
 const create=async()=>{if(!form.title.trim())return toast.error("العنوان مطلوب");const uid=(await supabase.auth.getUser()).data.user?.id;const {error}=await supabase.from("admin_banners").insert({...form,created_by:uid});if(error)toast.error(errMsg(error));else{await audit("banner_create","banner");toast.success("تم إنشاء البانر");setForm({title:"",body:"",image_url:"",action_url:""});load()}};
 return <Section title="Banners — البانرات والإعلانات" icon={Megaphone}><div className={card+" p-4 grid gap-2 md:grid-cols-4"}>{(["title","body","image_url","action_url"] as const).map(k=><Input key={k} className={input} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={k}/>) }<Button onClick={create}><Plus className="h-4 w-4"/> إضافة</Button></div><div className="space-y-2">{rows.map(b=><div key={b.id} className={card+" p-4 flex flex-wrap items-center justify-between gap-3"}><div><b>{b.title}</b><div className="text-xs text-muted-foreground">{b.body||"—"} · {b.is_active?"Active":"Disabled"}</div></div><Button variant={b.is_active?"destructive":"default"} onClick={async()=>{const {error}=await supabase.from("admin_banners").update({is_active:!b.is_active}).eq("id",b.id);if(error)toast.error(errMsg(error));else load()}}>{b.is_active?"تعطيل":"تفعيل"}</Button></div>)}</div></Section>
}

function NotificationsTab({refresh}:{refresh:number}){
 const [users,setUsers]=useState<Profile[]>([]);const [form,setForm]=useState({user_id:"",title:"",body:""});const load=async()=>{const {data}=await supabase.from("profiles").select("id,username,display_name,level,vip_level,country,created_at").order("created_at",{ascending:false}).limit(30);setUsers(data??[])};useEffect(()=>{load()},[refresh]);
 const send=async()=>{if(!form.user_id||!form.title)return toast.error("اختر المستخدم واكتب العنوان");const {error}=await supabase.from("user_notifications").insert(form);if(error)toast.error(errMsg(error));else{await audit("notification_send","user",form.user_id,{title:form.title});toast.success("تم إرسال الإشعار");setForm({user_id:"",title:"",body:""})}};
 return <Section title="Notifications — الإشعارات" icon={Bell}><div className={card+" p-4 grid gap-3"}><select className="rounded-lg border border-white/10 bg-background p-2" value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})}><option value="">اختر المستخدم</option>{users.map(u=><option key={u.id} value={u.id}>{u.display_name||u.username||u.id}</option>)}</select><Input className={input} placeholder="عنوان" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><Input className={input} placeholder="نص الإشعار" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/><Button onClick={send}><Bell className="h-4 w-4"/> إرسال</Button></div></Section>
}

function AssetsTab({refresh}:{refresh:number}){
 const [rows,setRows]=useState<any[]>([]);const [form,setForm]=useState({asset_key:"",name:"",category:"room",url:""});
 const load=async()=>{const {data,error}=await supabase.from("admin_assets").select("*").order("created_at",{ascending:false});if(error)toast.error(errMsg(error));else setRows(data??[])};useEffect(()=>{load()},[refresh]);
 const add=async()=>{if(!form.asset_key||!form.name)return toast.error("Asset key واسم الأصل مطلوبان");const {error}=await supabase.from("admin_assets").insert(form);if(error)toast.error(errMsg(error));else{await audit("asset_create","asset",form.asset_key);toast.success("تمت إضافة الأصل");setForm({asset_key:"",name:"",category:"room",url:""});load()}};
 return <Section title="3D Assets — مكتبة الأصول" icon={Boxes}><div className={card+" p-4 grid gap-2 md:grid-cols-4"}>{(["asset_key","name","category","url"] as const).map(k=><Input key={k} className={input} placeholder={k} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>) }<Button onClick={add}><Plus className="h-4 w-4"/> إضافة أصل</Button></div><div className="grid gap-3 md:grid-cols-3">{rows.map(a=><div key={a.id} className={card+" p-4"}><div className="flex justify-between"><b>{a.name}</b><span className="text-xs">{a.category}</span></div><div className="mt-1 text-xs text-muted-foreground" dir="ltr">{a.asset_key}</div>{a.url&&<a className="mt-2 block truncate text-xs text-primary" href={a.url} target="_blank" rel="noreferrer">{a.url}</a>}<Button className="mt-3" size="sm" variant="outline" onClick={async()=>{const {error}=await supabase.from("admin_assets").update({is_active:!a.is_active}).eq("id",a.id);if(error)toast.error(errMsg(error));else load()}}>{a.is_active?"تعطيل":"تفعيل"}</Button></div>)}</div></Section>
}

function ReportsTab({refresh}:{refresh:number}){
 const [rows,setRows]=useState<any[]>([]);const load=async()=>{const {data,error}=await supabase.from("admin_reports").select("*").order("created_at",{ascending:false}).limit(100);if(error)toast.error(errMsg(error));else setRows(data??[])};useEffect(()=>{load()},[refresh]);
 const resolve=async(id:string)=>{const uid=(await supabase.auth.getUser()).data.user?.id;const {error}=await supabase.from("admin_reports").update({status:"resolved",resolved_by:uid,resolved_at:new Date().toISOString(),resolution:"تمت المعالجة من لوحة الإدارة"}).eq("id",id);if(error)toast.error(errMsg(error));else{await audit("report_resolve","report",id);load()}};
 return <Section title="Reports — البلاغات" icon={FileText}>{rows.length?<div className="space-y-2">{rows.map(r=><div key={r.id} className={card+" p-4 flex flex-wrap justify-between gap-3"}><div><b>{r.target_type}</b><div className="text-xs text-muted-foreground" dir="ltr">{r.target_id||"—"}</div><p className="mt-1 text-sm">{r.reason}</p><span className="text-xs">{r.status} · {fmt(r.created_at)}</span></div>{r.status!=="resolved"&&<Button onClick={()=>resolve(r.id)}><Check className="h-4 w-4"/> حل البلاغ</Button>}</div>)}</div>:<Empty text="لا توجد بلاغات"/></Section>
}

function RolesTab({refresh}:{refresh:number}){
 const [rows,setRows]=useState<any[]>([]);const [uid,setUid]=useState("");const [role,setRole]=useState("moderator");const load=async()=>{const {data,error}=await supabase.from("admin_roles").select("*").order("created_at",{ascending:false});if(error)toast.error(errMsg(error));else setRows(data??[])};useEffect(()=>{load()},[refresh]);
 const add=async()=>{if(!uid)return toast.error("User UUID مطلوب");const {error}=await supabase.from("admin_roles").upsert({user_id:uid,role});if(error)toast.error(errMsg(error));else{await audit("role_upsert","admin_role",uid,{role});toast.success("تم حفظ الدور");setUid("");load()}};
 const remove=async(id:string)=>{if(!confirm("إزالة الدور؟"))return;const {error}=await supabase.from("admin_roles").delete().eq("user_id",id);if(error)toast.error(errMsg(error));else{await audit("role_remove","admin_role",id);load()}};
 return <Section title="Admin Roles — الأدوار" icon={UserCog}><div className={card+" p-4 flex flex-wrap gap-2"}><Input className={input+" min-w-72"} value={uid} onChange={e=>setUid(e.target.value)} placeholder="User UUID"/><select className="rounded-lg border border-white/10 bg-background px-3" value={role} onChange={e=>setRole(e.target.value)}><option>moderator</option><option>admin</option></select><Button onClick={add}><Plus className="h-4 w-4"/> حفظ الدور</Button></div><div className="space-y-2">{rows.map(r=><div key={r.user_id} className={card+" p-4 flex justify-between"}><span dir="ltr">{r.user_id}</span><span className="flex items-center gap-2"><b>{r.role}</b><Button size="sm" variant="destructive" onClick={()=>remove(r.user_id)}><X className="h-4 w-4"/></Button></span></div>)}</div></Section>
}

function SettingsTab({refresh}:{refresh:number}){
 const [rows,setRows]=useState<any[]>([]);const [key,setKey]=useState("");const [value,setValue]=useState("{}");const load=async()=>{const {data,error}=await supabase.from("admin_settings").select("*").order("key");if(error)toast.error(errMsg(error));else setRows(data??[])};useEffect(()=>{load()},[refresh]);
 const save=async()=>{let json:any;try{json=JSON.parse(value)}catch{return toast.error("JSON غير صحيح")};const uid=(await supabase.auth.getUser()).data.user?.id;const {error}=await supabase.from("admin_settings").upsert({key,value:json,updated_by:uid,updated_at:new Date().toISOString()});if(error)toast.error(errMsg(error));else{await audit("setting_update","setting",key);toast.success("تم الحفظ");load()}};
 return <Section title="Settings — إعدادات المنصة" icon={Settings}><div className={card+" p-4 grid gap-2 md:grid-cols-3"}><Input className={input} value={key} onChange={e=>setKey(e.target.value)} placeholder="setting key"/><Input className={input+" md:col-span-2"} value={value} onChange={e=>setValue(e.target.value)} placeholder='{"enabled":true}'/><Button onClick={save}><Save className="h-4 w-4"/> حفظ</Button></div><div className="space-y-2">{rows.map(r=><div key={r.key} className={card+" p-4"}><b>{r.key}</b><pre className="mt-2 overflow-auto text-xs text-muted-foreground">{JSON.stringify(r.value,null,2)}</pre></div>)}</div></Section>
}

function AnalyticsTab({refresh}:{refresh:number}){
 const [d,setD]=useState({users:0,newUsers:0,rooms:0,activeMembers:0,tx:0,notifications:0});
 useEffect(()=>{(async()=>{const now=new Date();const week=new Date(now.getTime()-7*86400000).toISOString();const [u,nu,r,m,tx,n]=await Promise.all([
  supabase.from("profiles").select("id",{count:"exact",head:true}),supabase.from("profiles").select("id",{count:"exact",head:true}).gte("created_at",week),
  supabase.from("rooms").select("id",{count:"exact",head:true}),supabase.from("room_members").select("user_id",{count:"exact",head:true}),
  supabase.from("wallet_transactions").select("id",{count:"exact",head:true}),supabase.from("user_notifications").select("id",{count:"exact",head:true})
 ]);setD({users:u.count??0,newUsers:nu.count??0,rooms:r.count??0,activeMembers:m.count??0,tx:tx.count??0,notifications:n.count??0})})()},[refresh]);
 return <Section title="Analytics — التحليلات" icon={BarChart3}><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"><Stat label="Total users" value={d.users} icon={Users}/><Stat label="New users / 7d" value={d.newUsers} icon={Activity}/><Stat label="Rooms" value={d.rooms} icon={DoorOpen}/><Stat label="Room members" value={d.activeMembers} icon={Users}/><Stat label="Transactions" value={d.tx} icon={Wallet}/><Stat label="Notifications" value={d.notifications} icon={Bell}/></div><div className={card+" mt-4 p-5"}><p className="text-sm text-muted-foreground">هذه الطبقة تعتمد على بيانات Supabase الحقيقية. يمكن لاحقاً إضافة رسوم يومية ومؤشرات الإيرادات عند توافر أحداث مالية موحدة.</p></div></Section>
}

function AuditTab({refresh}:{refresh:number}){
 const [rows,setRows]=useState<any[]>([]);useEffect(()=>{supabase.from("admin_audit_log").select("*").order("created_at",{ascending:false}).limit(200).then(({data,error})=>{if(error)toast.error(errMsg(error));else setRows(data??[])})},[refresh]);
 return <Section title="Audit Log — سجل التدقيق" icon={History}><div className="space-y-2">{rows.length?rows.map(r=><div key={r.id} className={card+" p-4"}><div className="flex flex-wrap justify-between gap-2"><b>{r.action}</b><span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span></div><div className="mt-1 text-xs text-muted-foreground">{r.entity_type||"—"} · {r.entity_id||"—"}</div><pre className="mt-2 overflow-auto text-[11px] text-muted-foreground">{JSON.stringify(r.details||{},null,2)}</pre></div>):<Empty text="لا يوجد سجل بعد"/></div></Section>
}
