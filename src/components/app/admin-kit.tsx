import { useId, useRef, useState, cloneElement, isValidElement, type ReactNode } from 'react';
import { Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Coin } from './AppShell';
import { Media } from './ui';
import { avatarAt } from './data';
import type { AssetRow, CloudData } from './cloud';

export const fieldClass = 'h-10 w-full rounded-xl border border-border bg-secondary px-3 text-[12.5px] text-navy outline-none focus:border-primary';

/** Sections an uploaded asset can belong to; they match the store/catalog kinds. */
export const ASSET_SECTIONS: readonly { k: string; n: string }[] = [
  { k: 'gift', n: 'الهدايا' }, { k: 'entry', n: 'الدخوليات' }, { k: 'frame', n: 'الإطارات' }, { k: 'bubble', n: 'الفقاعات' },
  { k: 'seat', n: 'المايكات' }, { k: 'badge', n: 'الشارات' }, { k: 'sid', n: 'الأرقام المميزة' }, { k: 'vip', n: 'VIP' },
  { k: 'level', n: 'المستويات' }, { k: 'banner', n: 'البنرات' }, { k: 'event', n: 'الفعاليات' }, { k: 'welcome', n: 'الترحيب' },
  { k: 'room_frame', n: 'إطارات الغرف' }, { k: 'music', n: 'الأغاني' }, { k: 'splash', n: 'إعلان الفتح' }, { k: 'general', n: 'عام' },
];
export const sectionName = (k: string) => ASSET_SECTIONS.find(s => s.k === k)?.n ?? k;
/** Kinds a user can own (buy, receive, wear). */
export const OWNABLE = ['frame', 'entry', 'bubble', 'sid', 'seat', 'badge', 'vip'] as const;
export const isOwnable = (kind: string) => (OWNABLE as readonly string[]).includes(kind);
export const ACCEPT = 'image/*,video/*,audio/*,.svga,.gif,.webp,.svg,.apng,.avif,.mp4,.webm,.mov,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.json,.pag';
export const MAX_UPLOAD_MB = 50;

const EXT_MIME: Record<string, string> = {
  svga: 'application/x-svga', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/opus',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', gif: 'image/gif', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  svg: 'image/svg+xml', avif: 'image/avif', apng: 'image/apng', json: 'application/json',
};
/** MIME type stored for an uploaded file; phones often send none for SVGA or audio. */
export function assetMime(name: string, type: string): string {
  const ext = (name.split('.').at(-1) ?? '').toLowerCase();
  if (ext === 'svga') return EXT_MIME['svga']!;
  return type || EXT_MIME[ext] || 'application/octet-stream';
}
export type AssetType = 'image' | 'gif' | 'video' | 'audio' | 'svga' | 'other';
export function assetType(mime: string): AssetType {
  if (mime.includes('svga')) return 'svga';
  if (mime.includes('gif')) return 'gif';
  if (mime.startsWith('image')) return 'image';
  if (mime.startsWith('video')) return 'video';
  if (mime.startsWith('audio')) return 'audio';
  return 'other';
}
/** Uploads one file into the private library under its section and records it. */
export async function uploadAsset(file: File, section: string, userId: string, name?: string) {
  if (!userId) throw new Error('سجّل الدخول بحساب المسؤول أولاً');
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`الحجم أكبر من ${MAX_UPLOAD_MB}MB`);
  if (!file.size) throw new Error('الملف فارغ');

  // app_assets has required canonical columns in addition to its legacy
  // compatibility columns. Generate a unique stable key for every upload.
  const safeSection = section.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'general';
  const ext = (file.name.includes('.') ? file.name.split('.').at(-1)! : 'bin')
    .toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const mime = assetMime(file.name, file.type);
  const id = crypto.randomUUID();
  const path = `library/${safeSection}/${id}.${ext}`;
  const assetKey = `upload/${safeSection}/${id}`;
  const title = (name?.trim() || file.name.replace(/\.[^.]+$/, '') || 'ملف جديد').slice(0, 180);
  // Keep category values inside the database CHECK constraint; section remains the
  // user-facing grouping and may use richer names than the canonical asset category.
  const category = ({
    entry: 'entrance', vip: 'vip', sid: 'icon', badge: 'icon', level: 'icon',
    room_frame: 'frame', bubble: 'page_element', seat: 'page_element',
    music: 'sound', event: 'banner', welcome: 'page_element',
    splash: 'page_element', general: 'other',
  } as Record<string, string>)[safeSection] ?? (['gift', 'frame', 'entrance', 'banner'].includes(safeSection) ? safeSection : 'other');

  const { error: storageError } = await supabase.storage.from('app-assets').upload(path, file, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (storageError) throw new Error(/row-level security|policy|Unauthorized/i.test(storageError.message)
    ? 'الرفع يحتاج حساب مسؤول' : storageError.message);

  const { data, error: dbError } = await supabase.from('app_assets').insert({
    asset_key: assetKey,
    title,
    category,
    storage_path: path,
    mime_type: mime,
    is_active: true,
    sort_order: 0,
    metadata: { source: 'admin-upload', original_name: file.name, section: safeSection },
    section: safeSection,
    name: title,
    path,
    mime,
    created_by: userId,
  }).select('id').single();

  if (dbError) {
    // Do not leave an orphaned Storage object if the metadata row is rejected.
    await supabase.storage.from('app-assets').remove([path]);
    throw new Error(dbError.message);
  }
  return data.id;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId();
  return <div className="space-y-1"><label htmlFor={id} className="block text-[11.5px] font-bold text-navy">{label}</label>{isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children}{hint && <p className="text-[10.5px] text-muted-foreground">{hint}</p>}</div>;
}
export function Block({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return <section className="surface space-y-3 p-3.5"><div className="flex items-center justify-between gap-2"><h2 className="text-[14px] font-black text-navy">{title}</h2>{right}</div>{children}</section>;
}
export function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-[12px] text-muted-foreground">{text}</p>; }
export function Pills<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly { k: T; n: string }[] }) {
  return <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">{options.map(o => <button type="button" key={String(o.k)} onClick={() => onChange(o.k)} className={`chip press shrink-0 ${value === o.k ? 'chip-active' : ''}`}>{o.n}</button>)}</div>;
}
const DAY_OPTIONS = [0, 1, 3, 7, 30, 90];
/** Duration in days; 0 means permanent. */
export function DurationPicker({ label, value, onChange, forever = 'دائم' }: { label: string; value: number; onChange: (days: number) => void; forever?: string }) {
  return <Field label={label}><div className="flex flex-wrap items-center gap-1.5">
    {DAY_OPTIONS.map(n => <button type="button" key={n} onClick={() => onChange(n)} className={`chip press ${value === n ? 'chip-active' : ''}`}>{n === 0 ? forever : `${n} يوم`}</button>)}
    <Input aria-label={`${label} بالأيام`} type="number" min="0" max="3650" inputMode="numeric" className={`${fieldClass} h-8 w-20`} value={value || ''} placeholder="أيام" onChange={e => onChange(Math.max(0, Math.min(3650, Math.floor(Number(e.target.value) || 0))))} />
  </div></Field>;
}
/** User lookup by ID with a live preview of who will be affected. */
export function UserPick({ uid, setUid, profiles, label = 'ID المستخدم' }: { uid: string; setUid: (v: string) => void; profiles: CloudData['profiles']; label?: string }) {
  const u = findProfile(profiles, uid);
  return <div className="space-y-1.5"><Field label={label}><Input className={fieldClass} dir="ltr" value={uid} onChange={e => setUid(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="ID" /></Field>
    {uid && (u ? <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-2.5 py-1.5"><img src={u.avatar || avatarAt(0)} alt="" className="h-8 w-8 rounded-full object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-black text-navy">{u.name}</p><p className="text-[10.5px] text-muted-foreground" dir="ltr">ID {u.uid} · Lv {u.level} · VIP {u.vip}</p></div><Coin n={u.coins} className="text-[11.5px] text-navy" /></div> : <p className="text-[11px] font-bold text-destructive">لا يوجد مستخدم بهذا الـ ID</p>)}
  </div>;
}
export const findProfile = (profiles: CloudData['profiles'], uid: string) => uid ? profiles.find(p => String(p.uid) === uid || p.special_id === uid) : undefined;

/** Grid of library assets to choose from, with one-tap upload straight into the section. */
export function AssetPicker({ assets, section, value, onChange, userId, onUploaded }: { assets: AssetRow[]; section: string; value: string | null | undefined; onChange: (id: string | null) => void; userId: string; onUploaded: () => Promise<unknown> }) {
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = assets.filter(a => all || a.section === section || a.id === value);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError('');
    try { const id = await uploadAsset(file, section, userId); await onUploaded(); onChange(id); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذّر الرفع'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2"><span className="text-[11.5px] font-bold text-navy">الأصل · {sectionName(section)}</span><button type="button" className="text-[11px] font-bold text-primary" onClick={() => setAll(v => !v)}>{all ? 'هذا القسم فقط' : 'كل الأقسام'}</button></div>
    <input ref={input} type="file" className="sr-only" aria-label="رفع ملف للقسم" accept={ACCEPT} onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
    <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto">
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="press flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-[10.5px] font-black text-primary"><Upload className="h-5 w-5" />{busy ? 'جارٍ الرفع' : 'رفع ملف'}</button>
      {list.map(a => <button type="button" key={a.id} title={a.name} onClick={() => onChange(a.id === value ? null : a.id)} className={`relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-muted p-1 ${a.id === value ? 'ring-2 ring-primary' : ''}`}><Media src={a.url} mime={a.mime} alt={a.name} className="h-full w-full" />{a.id === value && <span className="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>}</button>)}
    </div>
    {error && <p className="text-[11px] font-bold text-destructive">{error}</p>}
    {!list.length && <p className="text-[10.5px] text-muted-foreground">لا توجد ملفات في هذا القسم بعد؛ ارفع ملفاً أو اعرض كل الأقسام.</p>}
  </div>;
}
export { Button, Input };
