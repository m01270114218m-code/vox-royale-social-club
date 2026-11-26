import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Armchair, Award, BadgeDollarSign, Bell, Building2, CalendarDays, ChevronLeft, CircleDashed, Coins, Crown, DoorOpen, FlaskConical, FolderUp, Gift, Hash, Image as ImageIcon, MessageCircle, Music2, Palette, PartyPopper, Rocket, ScrollText, Search, Send, ShieldCheck, SquareDashed, Trash2, TrendingUp, Upload, Users, Wallet, Wrench, CheckCircle2, XCircle, Loader2, type LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { images, avatarAt } from './data';
import { SubHeader, Coin } from './AppShell';
import { useCloud, useCloudActions, type CatalogInsert, type CloudData } from './cloud';
import { canAdmin } from './control-rules';
import { toast } from './toast';
import { Sheet, Media, SpecialId, UserName } from './ui';
import { remainingLabel } from './daily';
import { SPLASH_SECONDS } from './splash';
import { ACCEPT, ASSET_SECTIONS, AssetPicker, Block, Button, DurationPicker, Empty, Field, Input, MAX_UPLOAD_MB, Pills, UserPick, assetType, fieldClass, findProfile, isOwnable, sectionName, uploadAsset } from './admin-kit';

type Sec = { k: string; n: string; i: LucideIcon };
const groups: { n: string; items: Sec[] }[] = [
  { n: 'المالية', items: [{ k: 'recharge_requests', n: 'طلبات الشحن', i: Wallet }, { k: 'coins', n: 'العملات', i: Coins }, { k: 'recharge', n: 'وكلاء الشحن', i: BadgeDollarSign }] },
  { n: 'المستخدمون', items: [{ k: 'users', n: 'المستخدمون', i: Users }, { k: 'account_requests', n: 'طلبات الحسابات', i: ShieldCheck }, { k: 'grants', n: 'إرسال مباشر', i: Send }, { k: 'roles', n: 'الصلاحيات', i: ShieldCheck }, { k: 'style', n: 'ألوان الاسم', i: Palette }, { k: 'agencies', n: 'الوكالات', i: Building2 }, { k: 'notifications', n: 'الرسائل', i: Bell }] },
  { n: 'المحتوى والمتجر', items: [{ k: 'assets', n: 'مكتبة الأصول', i: FolderUp }, { k: 'gift', n: 'الهدايا', i: Gift }, { k: 'entry', n: 'الدخوليات', i: Rocket }, { k: 'frame', n: 'الإطارات', i: CircleDashed }, { k: 'bubble', n: 'الفقاعات', i: MessageCircle }, { k: 'seat', n: 'المايكات', i: Armchair }, { k: 'badge', n: 'الشارات', i: Award }, { k: 'sid', n: 'أرقام مميزة', i: Hash }, { k: 'vip', n: 'VIP', i: Crown }, { k: 'level', n: 'المستويات', i: TrendingUp }, { k: 'music', n: 'أغاني الغرف', i: Music2 }] },
  { n: 'واجهة التطبيق', items: [{ k: 'banner', n: 'البنرات', i: ImageIcon }, { k: 'event', n: 'الفعاليات', i: CalendarDays }, { k: 'welcome', n: 'الترحيب', i: PartyPopper }, { k: 'room_frame', n: 'إطارات الغرف', i: SquareDashed }, { k: 'rooms', n: 'الغرف', i: DoorOpen }] },
  { n: 'النظام', items: [{ k: 'updates', n: 'الصيانة والتحديث', i: Wrench }, { k: 'development', n: 'تشغيل الميزات', i: FlaskConical }, { k: 'audit', n: 'سجل الإدارة', i: ScrollText }] },
];
const allSections = groups.flatMap(g => g.items);
const catalogKinds = ['gift', 'entry', 'frame', 'sid', 'bubble', 'seat', 'badge', 'level', 'welcome', 'banner', 'vip', 'room_frame', 'event', 'music'];
const roleNames: Record<string, string> = { admin: 'مسؤول التطبيق', moderator: 'مشرف', bd: 'BD', recharge_agent: 'وكيل شحن', host_agent: 'وكيل مضيفين', host: 'مضيف' };
const giftTypes = [{ k: 'static', n: 'عادية' }, { k: 'animated', n: 'فاخرة' }, { k: 'lucky', n: 'حظ' }] as const;
const kindNames = [{ k: 'notification', n: 'إشعار' }, { k: 'official', n: 'رسمي' }, { k: 'reward', n: 'مكافأة' }] as const;
const when = (s: string) => new Date(s).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' });
const obj = (v: Json | undefined): Record<string, Json> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Json>) : {});

type Save = (fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean>;
type P = { d: CloudData; busy: boolean; save: Save; action: ReturnType<typeof useCloudActions>; uid: string; setUid: (v: string) => void; go: (k: string) => void; refresh: () => Promise<void> };

export function ControlPanel() {
  const q = useCloud();
  const d = q.data;
  const qc = useQueryClient();
  const nav = useNavigate();
  const action = useCloudActions();
  const [section, setSection] = useState('overview');
  const [uid, setUid] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = canAdmin(d?.roles ?? []);
  useEffect(() => { if (d && !admin) void nav({ to: '/', replace: true }); }, [d, admin, nav]);
  if (!d || !admin) return <div className="grid min-h-screen place-items-center">{q.isError ? <Button onClick={() => void q.refetch()}>إعادة المحاولة</Button> : <Loader2 className="h-6 w-6 animate-spin text-primary" />}</div>;
  const refresh = () => qc.invalidateQueries({ queryKey: ['cloud'] });
  const save: Save = async (fn, ok = 'تم الحفظ') => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw new Error(error.message); await refresh(); toast.success(ok); return true; }
    catch (e) { toast(e instanceof Error ? e.message : 'تعذّر الحفظ'); return false; }
    finally { setBusy(false); }
  };
  const p: P = { d, busy, save, action, uid, setUid, go: setSection, refresh };
  const current = allSections.find(s => s.k === section);
  return <div className="pb-8">
    <SubHeader title={current?.n ?? 'لوحة التحكم'} right={section !== 'overview' ? <Button variant="ghost" size="sm" className="text-[12px] font-bold text-primary" onClick={() => setSection('overview')}>الرئيسية</Button> : undefined} />
    <div className="space-y-3 px-3.5">
      {section === 'overview' && <Overview {...p} />}
      {section === 'assets' && <Assets {...p} />}
      {catalogKinds.includes(section) && <Catalog key={section} kind={section} {...p} />}
      {section === 'users' && <UsersList {...p} />}
      {section === 'account_requests' && <AccountRequests />}
      {section === 'grants' && <><DirectSend {...p} /><Levels {...p} /></>}
      {section === 'coins' && <CoinsSec {...p} />}
      {section === 'recharge_requests' && <Recharge {...p} />}
      {section === 'recharge' && <RoleToggle role="recharge_agent" title="تفعيل وكالة شحن للمستخدم" {...p} />}
      {section === 'roles' && <Roles {...p} />}
      {section === 'style' && <Style {...p} />}
      {section === 'agencies' && <Agencies {...p} />}
      {section === 'rooms' && <Rooms {...p} />}
      {section === 'updates' && <Updates {...p} />}
      {section === 'development' && <Development {...p} />}
      {section === 'notifications' && <Notify {...p} />}
      {section === 'audit' && <Block title="آخر العمليات">{d.audit.map(a => <div key={a.id} className="flex items-center justify-between border-b border-border/60 py-2 text-[11.5px] last:border-0"><b className="text-navy">{a.action}</b><span className="text-muted-foreground">{when(a.created_at)}</span></div>)}{!d.audit.length && <Empty text="لا توجد عمليات مسجلة" />}</Block>}
    </div>
  </div>;
}

type AccountRegistrationRequest = { id: string; display_name: string; email: string; status: string; created_at: string };

function AccountRequests() {
  const [items, setItems] = useState<AccountRegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("account_registration_requests")
      .select("id,display_name,email,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) toast(error.message);
    else setItems((data ?? []) as AccountRegistrationRequest[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const decide = async (item: AccountRegistrationRequest, status: "approved" | "rejected") => {
    setBusyId(item.id);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("انتهت جلسة المشرف، سجّل الدخول مرة أخرى");
      const { error } = await (supabase as any).from("account_registration_requests")
        .update({ status, reviewed_by: authData.user.id, reviewed_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("status", "pending");
      if (error) throw error;
      toast.success(status === "approved" ? "تمت الموافقة على الطلب" : "تم رفض الطلب");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذر تحديث الطلب");
    } finally {
      setBusyId("");
    }
  };
  return <Block title="طلبات إنشاء الحسابات">
    <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">تظهر هنا الحسابات الإضافية التي تحتاج موافقة. بعد الموافقة، يعيد المستخدم التسجيل بنفس البريد وكلمة المرور التي اختارها؛ كلمة المرور لا تُحفظ في لوحة الإدارة.</p>
    <div className="mb-3 flex justify-end"><Button size="sm" variant="outline" onClick={() => void load()} disabled={loading || !!busyId}>تحديث الطلبات</Button></div>
    {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : items.length ? <div className="space-y-2">
      {items.map(item => <div key={item.id} className="surface space-y-2.5 p-3">
        <div className="flex items-start gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Users className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black text-navy">{item.display_name}</p><p dir="ltr" className="truncate text-start text-[11px] text-muted-foreground">{item.email}</p><p className="mt-1 text-[10px] text-muted-foreground">طلب بتاريخ {when(item.created_at)} · جهاز أو شبكة سبق التسجيل منها</p></div>
          <span className="rounded-full bg-gold/20 px-2 py-1 text-[10px] font-bold text-navy">قيد المراجعة</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" disabled={!!busyId} onClick={() => void decide(item, "approved")}>{busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} موافقة</Button>
          <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => void decide(item, "rejected")}>{busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} رفض</Button>
        </div>
      </div>)}
    </div> : <Empty text="لا توجد طلبات حسابات معلقة" />}
  </Block>;
}

function Overview({ d, go }: P) {
  const [search, setSearch] = useState('');
  const pendingRecharge = d.recharges.filter(r => r.status === 'pending').length;
  const pendingAgencies = d.agencies.filter(a => a.status === 'pending').length;
  const badge: Record<string, number> = { recharge_requests: pendingRecharge, agencies: pendingAgencies };
  const stats = [
    { n: 'المستخدمون', v: d.profiles.length }, { n: 'الغرف', v: d.roomList.length }, { n: 'عناصر منشورة', v: d.catalog.filter(c => c.enabled).length },
    { n: 'الأصول', v: d.assets.length }, { n: 'محظورون', v: d.profiles.filter(x => x.banned).length }, { n: 'عملات الأعضاء', v: d.profiles.reduce((s, x) => s + x.coins, 0) },
  ];
  return <>
    <div className="vip-card relative overflow-hidden rounded-2xl p-4 text-primary-foreground shadow-lg">
      <img src={images.ice} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="relative flex items-center gap-3">
        <img src={d.profile?.avatar || avatarAt(0)} alt="" className="h-12 w-12 rounded-full border-2 border-gold object-cover" />
        <div className="min-w-0 flex-1"><p className="text-[10.5px] font-bold opacity-80">صدى شات · لوحة التحكم</p><h2 className="truncate text-[18px] font-black leading-tight">{d.profile?.name}</h2><p className="text-[10.5px] opacity-80" dir="ltr">ID {d.profile?.uid} · مسؤول التطبيق</p></div>
      </div>
      <div className="relative mt-3 grid grid-cols-3 gap-2">{stats.map(x => <div key={x.n} className="night-glass rounded-xl px-1 py-2 text-center"><b className="block text-[16px] font-black leading-tight">{x.v.toLocaleString('en')}</b><span className="text-[9.5px] opacity-85">{x.n}</span></div>)}</div>
    </div>
    {(pendingRecharge > 0 || pendingAgencies > 0) && <Block title="بانتظار قرارك">
      {pendingRecharge > 0 && <button onClick={() => go('recharge_requests')} className="press flex w-full items-center gap-2.5 rounded-xl bg-primary/10 px-3 py-2.5 text-start"><Wallet className="h-5 w-5 text-primary" /><span className="flex-1 text-[12.5px] font-bold text-navy">طلبات شحن جديدة</span><span className="rounded-full bg-badge px-2 text-[11px] font-black text-primary-foreground">{pendingRecharge}</span><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>}
      {pendingAgencies > 0 && <button onClick={() => go('agencies')} className="press flex w-full items-center gap-2.5 rounded-xl bg-primary/10 px-3 py-2.5 text-start"><Building2 className="h-5 w-5 text-primary" /><span className="flex-1 text-[12.5px] font-bold text-navy">طلبات وكالات</span><span className="rounded-full bg-badge px-2 text-[11px] font-black text-primary-foreground">{pendingAgencies}</span><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>}
    </Block>}
    <div className="relative"><Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="البحث في أقسام الإدارة" placeholder="ابحث عن قسم" className={`${fieldClass} pr-9`} value={search} onChange={e => setSearch(e.target.value)} /></div>
    {groups.map(g => { const items = g.items.filter(s => s.n.includes(search.trim())); return items.length ? <section key={g.n}><h3 className="mb-1.5 px-1 text-[11.5px] font-black text-muted-foreground">{g.n}</h3><div className="grid grid-cols-3 gap-2">{items.map(s => <button key={s.k} onClick={() => go(s.k)} className="surface press relative flex h-[84px] flex-col items-center justify-center gap-1.5 px-1 text-center"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><s.i className="h-[18px] w-[18px]" /></span><span className="text-[11px] font-bold leading-tight text-navy">{s.n}</span>{(badge[s.k] ?? 0) > 0 && <span className="absolute left-2 top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-badge px-1 text-[10px] font-black text-primary-foreground">{badge[s.k]}</span>}</button>)}</div></section> : null; })}
  </>;
}

type QueueItem = { name: string; state: 'wait' | 'up' | 'ok' | 'err'; error?: string };
function Assets({ d, busy, save, refresh }: P) {
  const [target, setTarget] = useState('gift');
  const [filter, setFilter] = useState('all');
  const [type, setType] = useState('all');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [working, setWorking] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uploadMany = async (files: File[]) => {
    if (!files.length || working) return;
    setWorking(true);
    setQueue(files.map(f => ({ name: f.name, state: 'wait' })));
    let ok = 0;
    for (const [i, file] of files.entries()) {
      setQueue(list => list.map((x, j) => j === i ? { ...x, state: 'up' } : x));
      try { await uploadAsset(file, target, d.profile?.id ?? ''); ok++; setQueue(list => list.map((x, j) => j === i ? { ...x, state: 'ok' } : x)); }
      catch (e) { const error = e instanceof Error ? e.message : 'تعذّر الرفع'; setQueue(list => list.map((x, j) => j === i ? { ...x, state: 'err', error } : x)); }
    }
    await refresh();
    setWorking(false); setFilter(target);
    toast(ok === files.length ? `تم رفع ${ok} ملف إلى ${sectionName(target)}` : `تم رفع ${ok} من ${files.length}`);
  };
  const shown = d.assets.filter(a => (filter === 'all' || a.section === filter) && (type === 'all' || assetType(a.mime ?? '') === type));
  const count = (k: string) => d.assets.filter(a => k === 'all' || a.section === k).length;
  return <>
    <Block title="رفع ملفات جديدة">
      <Field label="قسم الأصل" hint="الملفات تُحفظ في القسم المختار وتظهر عند إضافة عنصر في نفس القسم."><select className={fieldClass} value={target} onChange={e => setTarget(e.target.value)}>{ASSET_SECTIONS.map(s => <option key={s.k} value={s.k}>{s.n}</option>)}</select></Field>
      <input ref={input} aria-label="اختيار ملفات للرفع" className="sr-only" type="file" multiple accept={ACCEPT} onChange={e => { void uploadMany(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      <button type="button" disabled={working} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void uploadMany(Array.from(e.dataTransfer.files)); }} className={`press flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-3 py-5 text-center transition ${drag ? 'border-primary bg-primary/15' : 'border-primary/50 bg-primary/5'}`}>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground">{working ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</span>
        <span className="text-[13.5px] font-black text-navy">{working ? 'جارٍ الرفع…' : `اختر ملفات لرفعها إلى ${sectionName(target)}`}</span>
        <span className="text-[10.5px] text-muted-foreground">صور · GIF · WebP · SVGA · فيديو · أغاني وأصوات — حتى {MAX_UPLOAD_MB}MB للملف</span>
      </button>
      {queue.length > 0 && <div className="space-y-1">{queue.map((x, i) => <div key={`${x.name}${i}`} className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-[11px]">{x.state === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : x.state === 'err' ? <XCircle className="h-4 w-4 shrink-0 text-destructive" /> : <Loader2 className={`h-4 w-4 shrink-0 text-muted-foreground ${x.state === 'up' ? 'animate-spin' : ''}`} />}<span className="min-w-0 flex-1 truncate font-bold text-navy" dir="ltr">{x.name}</span>{x.error && <span className="shrink-0 text-destructive">{x.error}</span>}</div>)}</div>}
    </Block>
    <Pills value={filter} onChange={setFilter} options={[{ k: 'all', n: `الكل (${count('all')})` }, ...ASSET_SECTIONS.filter(s => count(s.k) > 0).map(s => ({ k: s.k, n: `${s.n} (${count(s.k)})` }))]} />
    <Pills value={type} onChange={setType} options={[{ k: 'all', n: 'كل الأنواع' }, { k: 'image', n: 'صور' }, { k: 'gif', n: 'GIF' }, { k: 'svga', n: 'SVGA' }, { k: 'video', n: 'فيديو' }, { k: 'audio', n: 'صوت' }]} />
    <div className="grid grid-cols-2 gap-2">{shown.map(a => { const used = d.catalog.some(c => c.asset_id === a.id); return <div key={a.id} className="surface min-w-0 space-y-1.5 p-2">
      <div className="grid h-28 place-items-center overflow-hidden rounded-xl bg-muted"><Media src={a.url} mime={a.mime} alt={a.name} controls={['audio','video'].includes(assetType(a.mime ?? ''))} className="max-h-28 w-full" /></div>
      <p className="truncate text-[11.5px] font-bold text-navy">{a.name}</p>
      <div className="flex items-center gap-1 text-[9.5px]"><span className="rounded-full bg-primary/10 px-1.5 font-bold uppercase text-primary" dir="ltr">{assetType(a.mime ?? '')}</span>{used && <span className="rounded-full bg-gold/25 px-1.5 font-bold text-navy">مستخدم</span>}</div>
      <div className="flex items-center gap-1"><select aria-label={`قسم ${a.name}`} disabled={busy} className={`${fieldClass} h-8 min-w-0 flex-1 px-1.5 text-[11px]`} value={a.section} onChange={e => void save(() => supabase.from('app_assets').update({ section: e.target.value }).eq('id', a.id), 'تم نقل الأصل')}>{ASSET_SECTIONS.map(s => <option key={s.k} value={s.k}>{s.n}</option>)}</select>
        <Button variant="ghost" size="icon" aria-label={`حذف ${a.name}`} title={used ? 'مستخدم في عنصر منشور' : 'حذف'} className="h-8 w-8 shrink-0 text-destructive" disabled={busy || used || a.path.startsWith('bundled/')} onClick={() => { if (window.confirm('حذف هذا الأصل نهائيًا؟')) void save(async () => { const result = await supabase.from('app_assets').delete().eq('id', a.id); if (!result.error) await supabase.storage.from('app-assets').remove([a.path]); return result; }, 'تم الحذف'); }}><Trash2 className="h-4 w-4" /></Button></div>
    </div>; })}</div>
    {!shown.length && <Empty text="لا توجد أصول في هذا القسم" />}
  </>;
}

function Catalog({ kind, ...p }: P & { kind: string }) {
  const { d, busy, save, refresh } = p;
  const [editor, setEditor] = useState<CatalogInsert | null>(null);
  const [publishDays, setPublishDays] = useState(-1);
  const name = allSections.find(s => s.k === kind)?.n ?? kind;
  const list = d.catalog.filter(c => c.kind === kind);
  const ranked = kind === 'vip' || kind === 'level';
  const own = isOwnable(kind);
  const meta = obj(editor?.metadata);
  const open = (value: CatalogInsert) => { setPublishDays(-1); setEditor(value); };
  const now = Date.now();
  const submit = () => { if (!editor) return; const row: CatalogInsert = { ...editor, name: editor.name.trim(), ...(publishDays >= 0 ? { publish_until: publishDays === 0 ? null : new Date(Date.now() + publishDays * 86400000).toISOString() } : {}) }; void save(async () => { const result = await supabase.from('app_catalog').upsert(row); if (!result.error) setEditor(null); return result; }, 'تم الحفظ والنشر'); };
  return <>
    <Button className="h-11 w-full text-[13.5px] font-black" onClick={() => open({ kind, name: '', price: 0, rank: ranked ? 1 : 0, description: '', link: '', enabled: true, home: kind === 'banner', position: list.length, duration_days: own ? 7 : 0, in_store: true, metadata: kind === 'gift' ? { type: 'static', banner_style: 'luxury' } : {} })}>إضافة إلى {name}</Button>
    <div className="space-y-2">{list.map(c => { const expired = !!c.publish_until && Date.parse(c.publish_until) <= now; return <div key={c.id} className="surface flex items-center gap-3 p-2.5">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">{c.url ? <Media src={c.url} mime={c.mime} className="h-14 w-14" /> : <Hash className="h-5 w-5 text-muted-foreground" />}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black text-navy">{c.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9.5px] font-bold">
          <span className={`rounded-full px-1.5 ${c.enabled && !expired ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{expired ? 'انتهى النشر' : c.enabled ? 'منشور' : 'مخفي'}</span>
          {own && !c.in_store && <span className="rounded-full bg-gold/25 px-1.5 text-navy">خاص · خارج المتجر</span>}
          {own && <span className="rounded-full bg-muted px-1.5 text-muted-foreground">{c.duration_days ? `${c.duration_days} يوم` : 'دائم'}</span>}
          {c.publish_until && !expired && <span className="rounded-full bg-muted px-1.5 text-muted-foreground">النشر: {remainingLabel(c.publish_until, now)}</span>}
          {kind === 'gift' && <span className="rounded-full bg-muted px-1.5 text-muted-foreground">{giftTypes.find(t => t.k === obj(c.metadata)['type'])?.n ?? 'عادية'}</span>}
        </div>
        {(own || kind === 'gift') && <Coin n={c.price} className="mt-0.5 text-[11px] text-navy" />}
      </div>
      <Button size="sm" variant="outline" onClick={() => { const { url, mime, ...value } = c; void url; void mime; open(value); }}>تعديل</Button>
    </div>; })}</div>
    {!list.length && <Empty text="لا توجد عناصر مضافة بعد" />}
    {own && <DirectSend kind={kind} {...p} />}
    <Sheet open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? `تعديل · ${name}` : `إضافة · ${name}`}><div className="space-y-3 px-4 pt-2">{editor && <>
      <Field label={kind === 'sid' ? 'رقم ID المميز' : 'الاسم'}><Input className={fieldClass} value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></Field>
      <AssetPicker assets={d.assets} section={kind} value={editor.asset_id} onChange={asset_id => setEditor({ ...editor, asset_id })} userId={d.profile?.id ?? ''} onUploaded={refresh} />
      {editor.asset_id && <div className="grid place-items-center rounded-xl bg-muted p-2"><Media src={d.assets.find(a => a.id === editor.asset_id)?.url ?? ''} mime={d.assets.find(a => a.id === editor.asset_id)?.mime} controls className="max-h-40 w-full" /></div>}
      {kind === 'gift' && <><Field label="نوع الهدية"><div className="grid grid-cols-3 gap-1.5">{giftTypes.map(t => <button type="button" key={t.k} onClick={() => setEditor({ ...editor, metadata: { ...meta, type: t.k } })} className={`chip press justify-center ${(meta['type'] ?? 'static') === t.k ? 'chip-active' : ''}`}>{t.n}</button>)}</div></Field>
        <Field label="شكل شريط الهدية عند الإرسال"><div className="grid grid-cols-2 gap-1.5">{([['luxury','فاخر'],['glass','شفاف'],['minimal','بسيط'],['neon','نيون']] as const).map(([k,n]) => <button type="button" key={k} onClick={() => setEditor({ ...editor, metadata: { ...meta, banner_style: k } })} className={`chip press justify-center ${(meta['banner_style'] ?? 'luxury') === k ? 'chip-active' : ''}`}>{n}</button>)}</div></Field>
        <div className="flex items-center justify-between text-[12px] font-bold text-navy"><span>عرض بملء الشاشة عند الإرسال</span><Switch checked={meta['full'] === true} onCheckedChange={full => setEditor({ ...editor, metadata: { ...meta, full } })} /></div></>}
      {(kind === 'gift' || kind === 'entry') && <Field label="صوت اختياري للهدية / الدخولية" hint="ارفع ملف الصوت أولاً في مكتبة الأصول ضمن نفس القسم، ثم اختره هنا."><select className={fieldClass} value={String(meta['audio_asset_key'] ?? '')} onChange={e => setEditor({ ...editor, metadata: { ...meta, audio_asset_key: e.target.value || null } })}><option value="">بدون صوت</option>{d.assets.filter(a => String(a.mime ?? a.mime_type ?? '').startsWith('audio/')).map(a => <option key={a.asset_key} value={a.asset_key}>{a.name}</option>)}</select>{meta['audio_asset_key'] && <audio className="mt-2 w-full" controls preload="none" src={d.assets.find(a => a.asset_key === meta['audio_asset_key'])?.url} />}</Field>}
      <div className="grid grid-cols-2 gap-2">
        {(own || kind === 'gift') && <Field label="السعر بالعملات"><Input type="number" min="0" inputMode="numeric" className={fieldClass} value={editor.price ?? 0} onChange={e => setEditor({ ...editor, price: Math.max(0, Number(e.target.value)) })} /></Field>}
        <Field label={ranked ? 'رقم المستوى' : 'ترتيب العرض'}><Input type="number" min="0" inputMode="numeric" className={fieldClass} value={ranked ? editor.rank ?? 0 : editor.position ?? 0} onChange={e => setEditor({ ...editor, [ranked ? 'rank' : 'position']: Number(e.target.value) })} /></Field>
      </div>
      {own && <DurationPicker label="مدة الامتلاك بعد الشراء" value={editor.duration_days ?? 0} onChange={duration_days => setEditor({ ...editor, duration_days })} />}
      <Field label="مدة النشر" hint={editor.publish_until ? `ينتهي النشر الحالي: ${when(editor.publish_until)}` : 'بدون تاريخ انتهاء حالياً'}><div className="flex flex-wrap gap-1.5">{[{ k: -1, n: 'بدون تغيير' }, { k: 0, n: 'دائم' }, { k: 1, n: 'يوم' }, { k: 7, n: '7 أيام' }, { k: 30, n: '30 يوماً' }].map(o => <button type="button" key={o.k} onClick={() => setPublishDays(o.k)} className={`chip press ${publishDays === o.k ? 'chip-active' : ''}`}>{o.n}</button>)}</div></Field>
      <Field label={kind === 'vip' ? 'الامتيازات' : kind === 'welcome' ? 'رسالة الترحيب' : 'الوصف'}><textarea className={`${fieldClass} h-20 py-2`} value={editor.description ?? ''} onChange={e => setEditor({ ...editor, description: e.target.value })} /></Field>
      {(kind === 'banner' || kind === 'event') && <Field label="رابط عند الضغط (اختياري)"><Input className={fieldClass} dir="ltr" type="url" placeholder="https://" value={editor.link ?? ''} onChange={e => setEditor({ ...editor, link: e.target.value })} /></Field>}
      <div className="space-y-2.5 rounded-xl bg-muted px-3 py-2.5 text-[12px] font-bold text-navy">
        <div className="flex items-center justify-between"><span>منشور</span><Switch checked={editor.enabled ?? true} onCheckedChange={enabled => setEditor({ ...editor, enabled })} /></div>
        {own && <div className="flex items-center justify-between"><span>يظهر في المتجر</span><Switch checked={editor.in_store ?? true} onCheckedChange={in_store => setEditor({ ...editor, in_store })} /></div>}
        {kind === 'banner' && <div className="flex items-center justify-between"><span>عرض في الصفحة الرئيسية</span><Switch checked={editor.home ?? false} onCheckedChange={home => setEditor({ ...editor, home })} /></div>}
      </div>
      <Button className="h-11 w-full font-black" disabled={busy || !editor.name.trim() || (!editor.asset_id && kind !== 'sid') || (!!editor.link && !/^https:\/\//.test(editor.link))} onClick={submit}>حفظ ونشر</Button>
      {editor.id && <Button variant="destructive" disabled={busy} className="w-full" onClick={() => { const id = editor.id; if (id && window.confirm('حذف العنصر؟')) void save(async () => { const result = await supabase.from('app_catalog').delete().eq('id', id); if (!result.error) setEditor(null); return { error: result.error ? { message: 'لا يمكن حذف عنصر يملكه مستخدمون؛ اجعله مخفياً بدلاً من ذلك' } : null }; }, 'تم الحذف'); }}>حذف العنصر</Button>}
    </>}</div></Sheet>
  </>;
}

// Optional audio for catalog gifts and entry effects is stored by asset key.
const privateKinds = ['frame', 'entry', 'bubble', 'seat', 'badge'];
/** Send an item to one user only: from the store, or a private asset that never appears in the store. */
function DirectSend({ d, busy, action, uid, setUid, refresh, kind }: P & { kind?: string }) {
  const [mode, setMode] = useState<'store' | 'private'>('store');
  const [item, setItem] = useState('');
  const [days, setDays] = useState(7);
  const [pKind, setPKind] = useState(kind && privateKinds.includes(kind) ? kind : 'badge');
  const [pName, setPName] = useState('');
  const [asset, setAsset] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const user = findProfile(d.profiles, uid);
  const items = d.catalog.filter(c => isOwnable(c.kind) && (!kind || c.kind === kind));
  const chosen = items.find(c => c.id === item);
  const canPrivate = !kind || privateKinds.includes(kind);
  const sendPrivate = async () => {
    if (!asset || !user) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.from('app_catalog').insert({ kind: pKind, name: pName.trim() || d.assets.find(a => a.id === asset)?.name || 'هدية خاصة', asset_id: asset, price: 0, enabled: true, in_store: false, duration_days: days }).select('id').single();
      if (error) throw new Error(error.message);
      if (await action('grant', { uid, id: data.id, days }, `تم الإرسال إلى ${user.name} فقط`)) { setAsset(null); setPName(''); }
    } catch (e) { toast(e instanceof Error ? e.message : 'تعذّر الإرسال'); }
    finally { setWorking(false); }
  };
  return <Block title="إرسال مباشر لمستخدم واحد">
    <p className="text-[11px] text-muted-foreground">يصل للمستخدم صاحب الـ ID فقط مع رسالة في قسم «مكافأة»، ولا يُرسل لأي شخص آخر.</p>
    <UserPick uid={uid} setUid={setUid} profiles={d.profiles} />
    {canPrivate && <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">{([['store', 'عنصر من القائمة'], ['private', 'أصل خاص خارج المتجر']] as const).map(([k, n]) => <button type="button" key={k} onClick={() => setMode(k)} className={`h-8 rounded-lg text-[11.5px] font-bold ${mode === k ? 'bg-secondary text-primary shadow-sm' : 'text-muted-foreground'}`}>{n}</button>)}</div>}
    {mode === 'store' || !canPrivate ? <>
      <Field label="العنصر"><select className={fieldClass} value={item} onChange={e => { setItem(e.target.value); setDays(items.find(c => c.id === e.target.value)?.duration_days ?? 7); }}><option value="">اختيار عنصر</option>{items.map(c => <option key={c.id} value={c.id}>{kind ? '' : `${sectionName(c.kind)} · `}{c.name}{c.in_store ? '' : ' (خاص)'}</option>)}</select></Field>
      {chosen?.url && <div className="grid h-24 place-items-center rounded-xl bg-muted"><Media src={chosen.url} mime={chosen.mime} className="h-20 w-full" /></div>}
    </> : <>
      {!kind && <Field label="نوع العنصر"><Pills value={pKind} onChange={v => { setPKind(v); setAsset(null); }} options={privateKinds.map(k => ({ k, n: sectionName(k) }))} /></Field>}
      <Field label="الاسم (اختياري)"><Input className={fieldClass} value={pName} onChange={e => setPName(e.target.value)} /></Field>
      <AssetPicker assets={d.assets} section={pKind} value={asset} onChange={setAsset} userId={d.profile?.id ?? ''} onUploaded={refresh} />
    </>}
    <DurationPicker label="مدة العنصر عند المستخدم" value={days} onChange={setDays} />
    {mode === 'store' || !canPrivate
      ? <Button className="h-11 w-full font-black" disabled={busy || !item || !user} onClick={() => void action('grant', { uid, id: item, days }, `تم الإرسال إلى ${user?.name ?? ''}`)}>إرسال إلى {user?.name ?? 'المستخدم'}</Button>
      : <Button className="h-11 w-full font-black" disabled={working || !asset || !user} onClick={() => void sendPrivate()}>{working ? 'جارٍ الإرسال…' : `إرسال خاص إلى ${user?.name ?? 'المستخدم'}`}</Button>}
  </Block>;
}

function Levels({ d, action, uid, setUid }: P) {
  const user = findProfile(d.profiles, uid);
  const [level, setLevel] = useState('1');
  const [vip, setVip] = useState('0');
  const [days, setDays] = useState(0);
  useEffect(() => { if (user) { setLevel(String(user.level)); setVip(String(user.vip)); } }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Block title="المستوى و VIP">
    <UserPick uid={uid} setUid={setUid} profiles={d.profiles} />
    {user?.vip_until && <p className="text-[11px] font-bold text-primary">VIP الحالي ينتهي بعد {remainingLabel(user.vip_until, Date.now())}</p>}
    <div className="grid grid-cols-2 gap-2"><Field label="المستوى"><Input type="number" min="1" max="100" className={fieldClass} value={level} onChange={e => setLevel(e.target.value)} /></Field><Field label="VIP"><Input type="number" min="0" max="12" className={fieldClass} value={vip} onChange={e => setVip(e.target.value)} /></Field></div>
    <DurationPicker label="مدة VIP" value={days} onChange={setDays} />
    <Button disabled={!user} className="h-11 w-full font-black" onClick={() => void action('levels', { uid, level: Number(level), vip: Number(vip), days })}>حفظ</Button>
  </Block>;
}

function UsersList({ d, action, setUid, go }: P) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  const list = d.profiles.filter(u => !term || u.name.includes(term) || String(u.uid).includes(term) || (u.special_id ?? '').includes(term));
  const jump = (uid: number, k: string) => { setUid(String(uid)); go(k); };
  return <>
    <div className="relative"><Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="الاسم أو ID" className={`${fieldClass} pr-9`} /></div>
    <p className="px-1 text-[11px] text-muted-foreground">{list.length} مستخدم</p>
    {list.map(u => { const roles = d.allRoles.filter(r => r.user_id === u.id); return <div key={u.id} className="surface space-y-2 p-3">
      <div className="flex items-center gap-2.5"><img src={u.avatar || avatarAt(0)} alt="" className="h-11 w-11 rounded-full object-cover" />
        <div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-black text-navy">{u.name}{u.banned && <span className="ms-1.5 rounded-full bg-destructive/10 px-1.5 text-[9.5px] text-destructive">محظور</span>}</p><p dir="ltr" className="text-start text-[10.5px] text-muted-foreground">ID {u.uid} · Lv {u.level} · VIP {u.vip}{u.vip_until ? ` (${remainingLabel(u.vip_until, Date.now())})` : ''}</p></div>
        <Coin n={u.coins} className="text-[12px] text-navy" /></div>
      {roles.length > 0 && <div className="flex flex-wrap gap-1">{roles.map(r => <span key={r.id} className="rounded-full bg-primary/10 px-2 text-[10px] font-bold text-primary">{roleNames[r.role] ?? r.role}</span>)}</div>}
      <div className="grid grid-cols-4 gap-1.5">
        <Button variant="secondary" size="sm" className="h-8 px-1 text-[11px]" onClick={() => jump(u.uid, 'coins')}>شحن</Button>
        <Button variant="secondary" size="sm" className="h-8 px-1 text-[11px]" onClick={() => jump(u.uid, 'grants')}>إرسال</Button>
        <Button variant="secondary" size="sm" className="h-8 px-1 text-[11px]" onClick={() => jump(u.uid, 'roles')}>صلاحيات</Button>
        <Button variant={u.banned ? 'outline' : 'destructive'} size="sm" className="h-8 px-1 text-[11px]" disabled={u.id === d.profile?.id} onClick={() => { if (window.confirm(u.banned ? 'إلغاء حظر المستخدم؟' : 'حظر هذا المستخدم؟')) void action('ban', { uid: String(u.uid), enabled: !u.banned }); }}>{u.banned ? 'فك الحظر' : 'حظر'}</Button>
      </div>
    </div>; })}
    {!list.length && <Empty text="لا يوجد مستخدمون" />}
  </>;
}

function CoinsSec({ d, action, uid, setUid }: P) {
  const [amount, setAmount] = useState('');
  const user = findProfile(d.profiles, uid);
  const label: Record<string, string> = { credit: 'شحن إداري', recharge: 'طلب شحن', transfer: 'تحويل وكيل', gift: 'هدية', lucky: 'ربح حظ', daily: 'دخول يومي' };
  return <>
    <Block title="شحن حساب مباشرة"><UserPick uid={uid} setUid={setUid} profiles={d.profiles} />
      <Field label="عدد العملات"><Input type="number" min="1" inputMode="numeric" className={fieldClass} value={amount} onChange={e => setAmount(e.target.value)} /></Field>
      <div className="grid grid-cols-4 gap-1.5">{[10000, 50000, 100000, 1000000].map(n => <button type="button" key={n} onClick={() => setAmount(String(n))} className={`chip press justify-center ${Number(amount) === n ? 'chip-active' : ''}`}>{n >= 1000000 ? `${n / 1000000}M` : `${n / 1000}K`}</button>)}</div>
      <Button disabled={!user || Number(amount) <= 0} className="h-11 w-full font-black" onClick={() => { if (window.confirm(`شحن ${Number(amount).toLocaleString('en')} عملة إلى ${user?.name}؟`)) void action('credit', { uid, amount: Number(amount) }); }}>إضافة العملات</Button></Block>
    <Block title="آخر حركات العملات">{d.ledger.map(t => <div key={t.id} className="flex items-center justify-between border-b border-border/60 py-2 text-[11.5px] last:border-0"><span className="min-w-0"><b className="block truncate text-navy">{d.profiles.find(x => x.id === t.recipient_id)?.name ?? 'مستخدم'}</b><span className="text-muted-foreground">{label[t.kind] ?? t.kind} · {when(t.created_at)}</span></span><Coin n={t.amount} className="text-navy" /></div>)}{!d.ledger.length && <Empty text="لا توجد حركات" />}</Block>
  </>;
}

function Recharge({ d, action }: P) {
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState('');
  const list = d.recharges.filter(r => tab === 'pending' ? r.status === 'pending' : r.status !== 'pending');
  const decide = async (id: string, status: 'approved' | 'rejected') => { setWorking(id); await action('recharge_decide', { id, status, message: notes[id] ?? '' }, status === 'approved' ? 'تم القبول وإضافة العملات' : 'تم الرفض وإبلاغ المستخدم'); setWorking(''); };
  return <>
    <Pills value={tab} onChange={setTab} options={[{ k: 'pending', n: `بانتظار القرار (${d.recharges.filter(r => r.status === 'pending').length})` }, { k: 'done', n: 'تمت معالجتها' }]} />
    {list.map(r => { const u = d.profiles.find(x => x.id === r.user_id); return <div key={r.id} className="surface space-y-2.5 p-3">
      <div className="flex items-center gap-2.5"><img src={u?.avatar || avatarAt(0)} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black text-navy">{u?.name ?? 'مستخدم'}</p><p className="text-[10.5px] text-muted-foreground"><span dir="ltr">ID {u?.uid ?? '—'}</span> · {when(r.created_at)}</p></div>
        <div className="text-end"><Coin n={r.coins} className="text-[14px] text-navy" />{r.price && <p className="text-[11px] font-bold text-primary" dir="ltr">{r.price}</p>}</div></div>
      {r.note && <p className="rounded-lg bg-muted px-2.5 py-1.5 text-[11.5px] text-navy">{r.note}</p>}
      {r.status === 'pending' ? <>
        <Input aria-label="رسالة للمستخدم" className={fieldClass} placeholder="رسالة للمستخدم (اختياري)" value={notes[r.id] ?? ''} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} />
        <div className="grid grid-cols-2 gap-2"><Button disabled={working === r.id} className="h-10 font-black" onClick={() => void decide(r.id, 'approved')}>قبول وشحن</Button><Button disabled={working === r.id} variant="outline" className="h-10 border-destructive font-black text-destructive" onClick={() => void decide(r.id, 'rejected')}>رفض</Button></div>
      </> : <p className={`text-[11.5px] font-bold ${r.status === 'approved' ? 'text-primary' : 'text-destructive'}`}>{r.status === 'approved' ? 'تم القبول' : 'تم الرفض'}{r.admin_note ? ` · ${r.admin_note}` : ''}</p>}
    </div>; })}
    {!list.length && <Empty text={tab === 'pending' ? 'لا توجد طلبات شحن جديدة' : 'لا توجد طلبات سابقة'} />}
  </>;
}

function RoleToggle({ d, action, uid, setUid, role, title }: P & { role: string; title: string }) {
  const user = findProfile(d.profiles, uid);
  const on = !!user && d.allRoles.some(r => r.user_id === user.id && r.role === role);
  const holders = d.profiles.filter(u => d.allRoles.some(r => r.user_id === u.id && r.role === role));
  return <><Block title={title}><UserPick uid={uid} setUid={setUid} profiles={d.profiles} />
    {user && <p className={`text-[12px] font-bold ${on ? 'text-primary' : 'text-muted-foreground'}`}>{on ? 'مفعّلة لهذا المستخدم' : 'غير مفعّلة'}</p>}
    <div className="grid grid-cols-2 gap-2"><Button disabled={!user || on} onClick={() => void action('role', { uid, role, enabled: true })}>تفعيل</Button><Button variant="outline" disabled={!user || !on} onClick={() => void action('role', { uid, role, enabled: false })}>إيقاف</Button></div></Block>
    <Block title={`${roleNames[role] ?? role} (${holders.length})`}>{holders.map(u => <button key={u.id} onClick={() => setUid(String(u.uid))} className="flex w-full items-center justify-between border-b border-border/60 py-2 text-[12px] last:border-0"><b className="text-navy">{u.name}</b><span className="text-muted-foreground" dir="ltr">ID {u.uid}</span></button>)}{!holders.length && <Empty text="لا يوجد" />}</Block></>;
}
function Roles(p: P) {
  const [role, setRole] = useState('moderator');
  return <><Pills value={role} onChange={setRole} options={Object.entries(roleNames).map(([k, n]) => ({ k, n }))} /><RoleToggle key={role} role={role} title={`صلاحية: ${roleNames[role]}`} {...p} /></>;
}

function Style({ d, action, uid, setUid }: P) {
  const [nameColor, setNameColor] = useState('#f5c542');
  const [idColor, setIdColor] = useState('#4fc3f7');
  const user = findProfile(d.profiles, uid);
  return <Block title="تلوين الاسم والـ ID"><UserPick uid={uid} setUid={setUid} profiles={d.profiles} />
    <div className="grid grid-cols-2 gap-2"><Field label="لون الاسم"><input type="color" className="h-10 w-full rounded-xl bg-secondary p-1" value={nameColor} onChange={e => setNameColor(e.target.value)} /></Field><Field label="لون الـ ID"><input type="color" className="h-10 w-full rounded-xl bg-secondary p-1" value={idColor} onChange={e => setIdColor(e.target.value)} /></Field></div>
    <div className="flex flex-col items-center gap-2 rounded-xl bg-muted py-4"><b className="name-tinted text-[16px]" style={{ ['--nc' as string]: nameColor }}>{user?.name ?? 'اسم المستخدم'}</b><span className="id-glass inline-flex rounded-full px-3 text-[12px] font-black leading-[22px]" style={{ ['--idc' as string]: idColor }} dir="ltr">ID {user?.uid ?? '0000'}</span></div>
    <div className="grid grid-cols-2 gap-2"><Button disabled={!user} onClick={() => void action('style', { uid, name_color: nameColor, id_color: idColor })}>نشر الألوان</Button><Button variant="outline" disabled={!user} onClick={() => void action('style', { uid, name_color: '', id_color: '' })}>إزالة الألوان</Button></div>
    {user && <p className="text-center text-[11px] text-muted-foreground">الحالي: <UserName uid={String(user.uid)} name={user.name} /> · <SpecialId uid={String(user.uid)} sid={user.special_id} /></p>}
  </Block>;
}

function Agencies({ d, action, uid, setUid }: P) {
  const [name, setName] = useState('');
  const user = findProfile(d.profiles, uid);
  return <><Block title="فتح وكالة مضيفين بالـ ID"><UserPick uid={uid} setUid={setUid} profiles={d.profiles} /><Field label="اسم الوكالة"><Input className={fieldClass} value={name} onChange={e => setName(e.target.value)} /></Field><Button className="w-full" disabled={!user} onClick={() => void action('create_agency', { uid, name })}>تفعيل الوكالة</Button></Block>
    <Block title="الوكالات والطلبات">{d.agencies.map(a => { const owner = d.profiles.find(x => x.id === a.owner_id); return <div key={a.id} className="space-y-2 border-b border-border/60 py-2.5 last:border-0"><div className="flex items-center justify-between"><div><p className="text-[13px] font-black text-navy">{a.name || owner?.name || 'طلب وكالة'}</p><p dir="ltr" className="text-start text-[10.5px] text-muted-foreground">ID {owner?.uid}</p></div><span className={`rounded-full px-2 text-[10.5px] font-bold ${a.status === 'approved' ? 'bg-primary/10 text-primary' : a.status === 'pending' ? 'bg-gold/25 text-navy' : 'bg-destructive/10 text-destructive'}`}>{a.status === 'pending' ? 'بانتظار القرار' : a.status === 'approved' ? 'مفعّلة' : 'مرفوضة'}</span></div><div className="grid grid-cols-2 gap-2"><Button size="sm" disabled={a.status === 'approved'} onClick={() => void action('agency_decide', { id: a.id, status: 'approved' })}>قبول</Button><Button variant="outline" size="sm" disabled={a.status === 'rejected'} onClick={() => void action('agency_decide', { id: a.id, status: 'rejected' })}>رفض / إيقاف</Button></div></div>; })}{!d.agencies.length && <Empty text="لا توجد وكالات" />}</Block></>;
}

function Rooms({ d, busy, save }: P) {
  const all = d.roomList;
  const frames = d.catalog.filter(c => c.kind === 'room_frame' || c.kind === 'frame');
  return <Block title={`الغرف (${all.length})`}>{all.map(r => { const roomDbId = r.dbId; if (!roomDbId) return null; const control = d.rooms.find(c => c.room_id === roomDbId); return <div key={r.id} className="space-y-2 border-b border-border/60 py-2.5 last:border-0">
    <div className="flex items-center gap-2.5"><img src={r.img} alt="" className="h-11 w-11 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black text-navy">{r.name}</p><p className="text-start text-[10.5px] text-muted-foreground" dir="ltr">ID {r.id}</p></div>
      <Button variant={control?.banned ? 'outline' : 'destructive'} disabled={busy} size="sm" className="h-8 text-[11px]" onClick={() => void save(() => supabase.from('room_controls').upsert({ room_id: roomDbId, banned: !control?.banned, frame_id: control?.frame_id ?? null }))}>{control?.banned ? 'فك الحظر' : 'حظر'}</Button></div>
    <select aria-label={`إطار ${r.name}`} disabled={busy} className={fieldClass} value={control?.frame_id ?? ''} onChange={e => void save(() => supabase.from('room_controls').upsert({ room_id: roomDbId, frame_id: e.target.value || null, banned: control?.banned ?? false }))}><option value="">بدون إطار</option>{frames.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
  </div>; })}</Block>;
}

function useSetting({ d, save }: P) {
  const read = (key: string) => obj(d.settings.find(s => s.key === key)?.value);
  const update = (key: string, patch: Record<string, Json>) => save(() => supabase.from('app_settings').upsert({ key, value: { ...read(key), ...patch } }));
  return { read, update };
}
function Updates(p: P) {
  const { read, update } = useSetting(p);
  const splash = read('splash'); const adId = typeof splash['asset_id'] === 'string' ? splash['asset_id'] : null;
  return <><Block title="إعلان فتح التطبيق" right={<Switch aria-label="تشغيل إعلان الفتح" checked={splash['enabled'] === true} disabled={!adId} onCheckedChange={enabled => void update('splash', { enabled })} />}>
      <p className="text-[11px] text-muted-foreground">صورة أو فيديو يراه المستخدم عند فتح التطبيق لمدة {SPLASH_SECONDS} ثوانٍ مع زر تخطي بالأعلى.</p>
      <AssetPicker assets={p.d.assets} section="splash" value={adId} onChange={id => void update('splash', id ? { asset_id: id } : { asset_id: null, enabled: false })} userId={p.d.profile?.id ?? ''} onUploaded={p.refresh} />
    </Block><Block title="وضع الصيانة"><div className="flex items-center justify-between text-[12.5px] font-bold text-navy"><span>إيقاف التطبيق للصيانة</span><Switch checked={read('maintenance')['enabled'] === true} onCheckedChange={enabled => void update('maintenance', { enabled })} /></div><Field label="رسالة الصيانة"><Input className={fieldClass} defaultValue={String(read('maintenance')['message'] ?? '')} onBlur={e => void update('maintenance', { message: e.target.value })} /></Field></Block>
    <Block title="التحديث الإجباري"><div className="flex items-center justify-between text-[12.5px] font-bold text-navy"><span>إجبار التحديث</span><Switch checked={read('update')['forced'] === true} onCheckedChange={forced => void update('update', { forced })} /></div><Field label="رقم الإصدار الأدنى"><Input className={fieldClass} type="number" defaultValue={String(read('update')['minimum'] ?? 1)} onBlur={e => void update('update', { minimum: Number(e.target.value) })} /></Field><Field label="رابط تحميل التطبيق"><Input className={fieldClass} dir="ltr" type="url" placeholder="https://" defaultValue={String(read('update')['url'] ?? '')} onBlur={e => { if (!e.target.value || /^https:\/\//.test(e.target.value)) void update('update', { url: e.target.value }); }} /></Field></Block></>;
}
function Development(p: P) {
  const { read, update } = useSetting(p);
  return <Block title="تشغيل وإيقاف الميزات">{[{ k: 'gifts', n: 'الهدايا' }, { k: 'store', n: 'المتجر' }, { k: 'agency_requests', n: 'طلبات الوكالات' }].map(x => <div key={x.k} className="flex items-center justify-between text-[12.5px] font-bold text-navy"><span>{x.n}</span><Switch checked={read('features')[x.k] !== false} onCheckedChange={v => void update('features', { [x.k]: v })} /></div>)}</Block>;
}

function Notify({ d, action, uid, setUid }: P) {
  const [kind, setKind] = useState<'notification' | 'official' | 'reward'>('official');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coins, setCoins] = useState('');
  const user = findProfile(d.profiles, uid);
  const send = async () => { if (await action('notify', { ...(uid ? { uid } : {}), title, body, kind, ...(kind === 'reward' && Number(coins) > 0 ? { coins: Number(coins) } : {}) }, uid ? `تم الإرسال إلى ${user?.name ?? ''}` : 'تم الإرسال للجميع')) { setTitle(''); setBody(''); setCoins(''); } };
  return <><Block title="إرسال رسالة">
    <Field label="القسم الذي تظهر فيه عند المستخدم"><div className="grid grid-cols-3 gap-1.5">{kindNames.map(k => <button type="button" key={k.k} onClick={() => setKind(k.k)} className={`chip press justify-center ${kind === k.k ? 'chip-active' : ''}`}>{k.n}</button>)}</div></Field>
    <UserPick uid={uid} setUid={setUid} profiles={d.profiles} label="ID المستخدم · اتركه فارغاً للإرسال للجميع" />
    <Field label="العنوان"><Input className={fieldClass} maxLength={80} value={title} onChange={e => setTitle(e.target.value)} /></Field>
    <Field label="نص الرسالة"><textarea className={`${fieldClass} h-24 py-2`} maxLength={600} value={body} onChange={e => setBody(e.target.value)} /></Field>
    {kind === 'reward' && <Field label="عملات مع المكافأة (اختياري)" hint="تُضاف لرصيد المستخدم المحدد فقط."><Input type="number" min="0" inputMode="numeric" className={fieldClass} value={coins} onChange={e => setCoins(e.target.value)} /></Field>}
    <Button disabled={!title.trim() || !body.trim() || (!!uid && !user) || (Number(coins) > 0 && !user)} className="h-11 w-full font-black" onClick={() => void send()}>{uid ? `إرسال إلى ${user?.name ?? '…'}` : 'إرسال للجميع'}</Button></Block>
    <Block title="المرسلة سابقًا">{d.notifications.map(n => { const to = d.profiles.find(x => x.id === n.user_id); return <div key={n.id} className="border-b border-border/60 py-2 text-[11.5px] last:border-0"><div className="flex items-center gap-1.5"><span className="rounded-full bg-primary/10 px-1.5 text-[9.5px] font-bold text-primary">{kindNames.find(k => k.k === n.kind)?.n ?? 'رسمي'}</span><b className="min-w-0 flex-1 truncate text-navy">{n.title}</b></div><p className="mt-0.5 text-navy/80">{n.body}</p><p className="text-[10.5px] text-muted-foreground">{n.user_id ? `إلى ${to?.name ?? 'مستخدم'} · ID ${to?.uid ?? ''}` : 'للجميع'} · {when(n.created_at)}</p></div>; })}{!d.notifications.length && <Empty text="لا توجد رسائل مرسلة" />}</Block></>;
}
