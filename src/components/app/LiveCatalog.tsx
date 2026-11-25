import { Button } from '@/components/ui/button';
import { useState, type ReactNode } from 'react';
import { useCloud, useCloudActions } from './cloud';
import { Coin } from './AppShell';
import { avatars } from './data';
import { Sheet, Media } from './ui';
import { remainingLabel } from './daily';
import { BannerCarousel } from './BannerCarousel';

const OWN = ['frame', 'entry', 'bubble', 'sid', 'seat', 'badge', 'vip'];
/** Items published by the administration: store goods, banners, events. */
export function LiveCatalog({ kind, home = false, empty }: { kind?: string; home?: boolean; empty?: ReactNode }) {
  const { data } = useCloud();
  const act = useCloudActions();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = data?.profile?.id;
  const ownedOf = (id: string) => data?.items.find(i => i.user_id === me && i.catalog_id === id);
  const list = data?.catalog.filter(c => c.enabled && (kind ? c.kind === kind : home ? c.home : OWN.includes(c.kind) && c.kind !== 'vip') && (!OWN.includes(c.kind) || c.in_store || !!ownedOf(c.id))) ?? [];
  const sel = data?.catalog.find(c => c.id === selected);
  const ownedItem = sel ? ownedOf(sel.id) : undefined;
  if (!list.length) return <>{empty ?? null}</>;
  const now = Date.now();
  const purchase = async () => { if (!sel) return; setBusy(true); try { if (await act(ownedItem ? 'equip' : 'buy', { id: sel.id }, ownedItem ? 'تم الارتداء' : 'تم الشراء')) setSelected(null); } finally { setBusy(false); } };
  if (home || kind === 'banner') return <BannerCarousel slides={list} />;
  const wide = kind === 'event';
  return <><div className={wide ? 'space-y-3' : 'grid grid-cols-3 gap-2'}>{list.map(c => {
    const owned = ownedOf(c.id);
    const link = c.link && /^https:\/\//.test(c.link) ? c.link : '';
    if (wide) {
      const inner = <>{c.url && <Media src={c.url} mime={c.mime} alt={c.name} className="aspect-[2.6/1] w-full object-cover" />}{(c.description || !c.url) && <div className="px-3 py-2"><p className="text-[13px] font-black text-navy">{c.name}</p>{c.description && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{c.description}</p>}</div>}</>;
      return link ? <a key={c.id} href={link} target="_blank" rel="noopener noreferrer" className="surface press block overflow-hidden">{inner}</a> : <div key={c.id} className="surface overflow-hidden">{inner}</div>;
    }
    return <button type="button" key={c.id} onClick={() => setSelected(c.id)} className="surface press flex min-w-0 flex-col items-center gap-1 p-2 text-center">
      <span className="grid h-20 w-full place-items-center">{c.url && <Media src={c.url} mime={c.mime} alt={c.name} className="h-20 w-full" />}</span>
      <span className="w-full truncate text-[12px] font-bold text-navy">{c.name}</span>
      <span className="text-[10px] text-muted-foreground">{owned ? remainingLabel(owned.expires_at, now) : c.duration_days ? `${c.duration_days} يوم` : 'دائم'}</span>
      {owned ? <span className={`rounded-full px-2 text-[10.5px] font-bold ${owned.equipped ? 'bg-primary/10 text-primary' : 'bg-muted text-navy'}`}>{owned.equipped ? 'مُرتدى' : 'ارتداء'}</span> : <Coin n={c.price} className="text-[11.5px] text-navy" />}
    </button>;
  })}</div><Sheet open={!!sel} onClose={() => setSelected(null)} title={sel?.name ?? ''}>{sel && <div className="space-y-4 px-4 pt-3"><div className="relative mx-auto grid h-44 max-w-[300px] place-items-center">
    {sel.kind === 'frame' && <img src={data?.profile?.avatar || avatars[0]} alt="" className="h-24 w-24 rounded-full object-cover" />}
    {sel.url && <Media src={sel.url} mime={sel.mime} alt={sel.name} controls={sel.kind !== 'frame'} className={`h-40 w-64 ${sel.kind === 'frame' ? 'absolute inset-0 mx-auto' : ''}`} />}
    {sel.kind === 'bubble' && <p className="absolute inset-x-6 text-center text-[13px] font-semibold text-navy">أهلاً بالجميع، نورتوا الغرفة</p>}
  </div>{sel.description && <p className="text-center text-[12px] text-muted-foreground">{sel.description}</p>}
    <p className="text-center text-[12px] font-bold text-navy">{ownedItem ? `المتبقي: ${remainingLabel(ownedItem.expires_at, now)}` : `المدة: ${sel.duration_days ? `${sel.duration_days} يوم` : 'دائم'}`}</p>
    {OWN.includes(sel.kind) && <Button disabled={!data?.profile || busy || ownedItem?.equipped} className="h-11 w-full font-black" onClick={() => void purchase()}>{busy ? 'جارٍ الحفظ' : ownedItem?.equipped ? 'مُرتدى' : ownedItem ? 'ارتداء' : <>شراء <Coin n={sel.price} /></>}</Button>}</div>}</Sheet></>;
}
