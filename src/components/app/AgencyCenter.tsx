import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCloud, useCloudActions } from './cloud';
import { SubHeader, Coin } from './AppShell';
import { icons } from './data';
import { canRecharge, canHost, canCreateAgency } from './control-rules';
import { fmtDur } from './centers';
import { toast } from './toast';
const input='h-11 rounded-xl bg-secondary text-[13px]';
export function AgencyCenter({mode}:{mode:'agent'|'bd'|'host'|'recharge'}) {
  const {data,isPending,isError,refetch}=useCloud();
  const act=useCloudActions();
  const qc=useQueryClient();
  const [uid,setUid]=useState('');
  const [name,setName]=useState('');
  const [slogan,setSlogan]=useState('');
  const [image,setImage]=useState('');
  const [amount,setAmount]=useState('10000');
  const [busy,setBusy]=useState(false);
  const [agencyImageUrl,setAgencyImageUrl]=useState('');
  const title=mode==='agent'?'وكيل المضيفين':mode==='bd'?'مركز BD':mode==='host'?'مركز المضيف':'وكيل الشحن';
  const ag=data?.agencies.find(a=>a.owner_id===data.profile?.id);
  const agencyHosts=data?.hosts.filter(h=>h.agency_id===ag?.id) ?? [];
  const hostProfiles=agencyHosts.map(h=>data?.profiles.find(p=>p.id===h.user_id)).filter((p):p is NonNullable<typeof p>=>!!p);
  const totalDiamonds=hostProfiles.reduce((sum,p)=>sum+Number(p.diamonds||0),0);
  const agencyLevel=Math.max(1,Math.floor(totalDiamonds/100000)+1);
  const allowed=mode==='agent'?data?.roles.includes('host_agent'):mode==='bd'?canCreateAgency(data?.roles??[]):mode==='host'?canHost(data?.roles??[]):canRecharge(data?.roles??[]);
  const perform=async(action:string,payload:Record<string,string|number>)=>{setBusy(true);await act(action,payload);setBusy(false);};
  useEffect(()=>{let live=true;if(!ag?.image_path){setAgencyImageUrl('');return;}void supabase.storage.from('app-assets').createSignedUrl(ag.image_path,3600).then(({data,error})=>{if(live)setAgencyImageUrl(error?'':data?.signedUrl??'');});return()=>{live=false;};},[ag?.image_path]);
  const upload=async(file:File)=>{
    if(!data?.profile)return;
    setBusy(true);
    try{const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`agency/${data.profile.id}/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from('app-assets').upload(path,file);if(error)throw new Error(error.message);setImage(path);toast.success('تم رفع صورة الوكالة');}catch(e){toast(e instanceof Error?e.message:'تعذّر الرفع');}finally{setBusy(false);}
  };
  const hostIds=agencyHosts.map(h=>h.user_id);
  const target=data?.profiles.find(p=>String(p.uid)===uid||p.special_id===uid);
  return <div className="pb-6"><SubHeader title={title}/><div className="space-y-4 px-3.5">
    <div className="vip-card flex items-center gap-3 rounded-xl p-4 text-primary-foreground"><img src={mode==='recharge'?icons.recharge:mode==='bd'?icons.bd:icons.hostAgent} alt="" className="h-16 w-16 object-contain"/><div><h2 className="text-[19px] font-black">{mode==='agent'&&ag?.name?ag.name:title}</h2><p className="mt-1 text-[11px]">{allowed?'مفعّل':'غير مفعّل'}</p></div></div>
    {isPending&&<p className="text-center text-[12px]">جارٍ التحميل</p>}
    {isError&&<Button variant="outline" onClick={()=>void refetch()}>إعادة المحاولة</Button>}
    {!allowed&&!isPending&&<div className="space-y-3 text-center"><p className="text-[13px] text-muted-foreground">{mode==='agent'?'طلب فتح وكالة مضيفين من الإدارة':'هذا المركز يحتاج تفعيلًا من المسؤول'}</p>{mode==='agent'&&<Button className="w-full" disabled={busy||ag?.status==='pending'} onClick={async()=>{setBusy(true);try{const {error}=await supabase.rpc('request_host_agency');if(error)throw error;await qc.invalidateQueries({queryKey:['cloud']});toast.success('تم إرسال طلب الوكالة للإدارة');}catch(e){toast(e instanceof Error?e.message:'تعذّر إرسال طلب الوكالة');}finally{setBusy(false);}}}>{ag?.status==='pending'?'طلبك بانتظار موافقة الإدارة':'طلب فتح وكالة'}</Button>}</div>}
    {allowed&&mode==='agent'&&<>
      <section className="space-y-2 border-b pb-4"><h3 className="font-bold">بيانات الوكالة</h3>{agencyImageUrl&&<img src={agencyImageUrl} alt="صورة الوكالة" className="h-24 w-24 rounded-2xl object-cover"/>}<Input aria-label="اسم الوكالة" className={input} placeholder={ag?.name||'اسم الوكالة'} value={name} onChange={e=>setName(e.target.value)}/><Input aria-label="شعار الوكالة" className={input} placeholder={ag?.slogan||'شعار الوكالة'} value={slogan} onChange={e=>setSlogan(e.target.value)}/><label className="block text-[12px]">صورة الوكالة<input disabled={busy} type="file" accept="image/webp,image/png,image/jpeg" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);}} className="mt-2 block w-full text-[11px]"/></label><Button className="w-full" disabled={busy||!(name.trim()||ag?.name)} onClick={()=>void perform('agency_edit',{name:name||ag?.name||'',slogan:slogan||ag?.slogan||'',image_path:image||ag?.image_path||''})}>حفظ بيانات الوكالة</Button></section>
      <section className="space-y-2"><h3 className="font-bold">تفعيل مضيف بالـ ID</h3><Input className={input} placeholder="ID المضيف" inputMode="numeric" value={uid} onChange={e=>setUid(e.target.value.replace(/\D/g,''))}/>{target&&<p className="text-[12px] font-bold">{target.name}</p>}<Button className="w-full" disabled={busy||!target} onClick={()=>void perform('host_add',{uid})}>إضافة وتفعيل مركز المضيف</Button></section>
      <section className="space-y-2"><h3 className="font-bold">إحصائيات الوكالة</h3><div className="grid grid-cols-3 gap-2"><div className="surface p-3 text-center"><b className="text-lg">{hostProfiles.length}</b><p className="text-[10px] text-muted-foreground">المضيفون</p></div><div className="surface p-3 text-center"><b className="text-lg">{totalDiamonds.toLocaleString('en')}</b><p className="text-[10px] text-muted-foreground">إجمالي الألماس</p></div><div className="surface p-3 text-center"><b className="text-lg">{agencyLevel}</b><p className="text-[10px] text-muted-foreground">مستوى الوكالة*</p></div></div><p className="text-[10px] text-muted-foreground">* المستوى محسوب مبدئيًا: مستوى لكل 100,000 ألماسة.</p><h3 className="pt-2 font-bold">المضيفون ({hostIds.length})</h3>{hostProfiles.map(p=><div key={p.id} className="surface space-y-2 p-3"><div className="flex justify-between"><b>{p.name}</b><span className="text-[11px]">ID {p.uid}</span></div><div className="grid grid-cols-4 text-center text-[10px]"><span>نشاط<p className="font-bold">{fmtDur(p.app_seconds)}</p></span><span>مايك<p className="font-bold">{fmtDur(p.mic_seconds)}</p></span><span>هدايا<p className="font-bold">{p.gift_value.toLocaleString('en')}</p></span><span>ألماس<p className="font-bold">{p.diamonds.toLocaleString('en')}</p></span></div><Button size="sm" variant="outline" disabled={busy} onClick={()=>void perform('host_remove',{uid:String(p.uid)})}>إزالة المضيف</Button></div>)}</section>
    </>}
    {allowed&&mode==='bd'&&<><section className="space-y-2"><h3 className="font-bold">فتح وكالة مضيفين</h3><Input className={input} placeholder="ID الوكيل" value={uid} onChange={e=>setUid(e.target.value.replace(/\D/g,''))}/><Input className={input} placeholder="اسم الوكالة" value={name} onChange={e=>setName(e.target.value)}/><Button disabled={busy||!uid||!name.trim()} className="w-full" onClick={()=>void perform('create_agency',{uid,name})}>فتح الوكالة</Button></section>{data?.agencies.map(a=><div key={a.id} className="surface p-3"><b>{a.name}</b><p className="text-[11px] text-muted-foreground">{a.status==='approved'?'مفعّلة':'بانتظار المراجعة'}</p></div>)}</>}
    {allowed&&mode==='host'&&<div className="grid grid-cols-3 gap-2">{[{n:'وقت التطبيق',v:fmtDur(data?.profile?.app_seconds??0)},{n:'وقت المايك',v:fmtDur(data?.profile?.mic_seconds??0)},{n:'قيمة الهدايا',v:data?.profile?.gift_value??0}].map(x=><div key={x.n} className="surface py-4 text-center"><b className="text-[16px]">{x.v}</b><p className="mt-1 text-[10px] text-muted-foreground">{x.n}</p></div>)}</div>}
    {allowed&&mode==='recharge'&&<><div className="surface p-4"><p className="text-[11px] text-muted-foreground">رصيد الوكيل</p><Coin n={data?.profile?.coins??0} className="text-[24px]"/></div><Input className={input} placeholder="ID المستخدم" inputMode="numeric" value={uid} onChange={e=>setUid(e.target.value.replace(/\D/g,''))}/>{target&&<p className="font-bold">{target.name} · ID {target.uid}</p>}<Input className={input} type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} aria-label="عدد العملات"/><div className="grid grid-cols-4 gap-2">{[10000,50000,100000,500000].map(n=><Button key={n} size="sm" variant={Number(amount)===n?'default':'secondary'} onClick={()=>setAmount(String(n))}>{n/1000}K</Button>)}</div><Button disabled={busy||!target||Number(amount)<=0} className="w-full" onClick={()=>{if(window.confirm(`إرسال ${amount} عملة إلى ${target?.name}؟`))void perform('transfer',{uid,amount:Number(amount)});}}>إرسال العملات</Button><section className="space-y-2"><h3 className="font-bold">سجل العمليات</h3>{data?.ledger.filter(t=>t.sender_id===data.profile?.id).map(t=><div key={t.id} className="surface flex justify-between p-3 text-[11px]"><span>{data.profiles.find(p=>p.id===t.recipient_id)?.name}<p>{new Date(t.created_at).toLocaleString('ar')}</p></span><Coin n={t.amount}/></div>)}</section></>}
  </div></div>;
}