import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { publishCloud, type CatalogItem } from './cloud-state';
import { useAuth } from './session';
import { toast } from './toast';
import { installCatalog, installRooms, bundledAssets, avatarAt, roomCover, type Room } from './data';
import { stillValid } from './daily';

export async function cloudAction(action: string, payload: Record<string, Json>) {
  const { data, error } = await supabase.rpc('app_action', { action, payload });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, Json>;
}
/** Signed URLs are cached so media does not reload every time cloud data refreshes. */
const signed = new Map<string, { url: string; until: number }>();
const SIGN_SECONDS = 6 * 3600;
export async function signMany(paths: string[]) {
  const now = Date.now();
  const need = [...new Set(paths)].filter(p => p && !bundledAssets[p] && (signed.get(p)?.until ?? 0) < now);
  if (need.length) {
    const { data, error } = await supabase.storage.from('app-assets').createSignedUrls(need, SIGN_SECONDS);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, { url: row.signedUrl, until: now + (SIGN_SECONDS - 600) * 1000 });
  }
  return (path: string) => bundledAssets[path] ?? signed.get(path)?.url ?? '';
}
export async function signedAsset(path: string) {
  if (!path) return '';
  return (await signMany([path]))(path);
}
const none = Promise.resolve({ data: [], error: null });
export async function fetchCloud() {
  // Cloud data is loaded in parallel. A transient auth/network issue must not
  // reject the entire app shell and turn every screen into the generic error page.
  let id: string | undefined;
  try {
    const { data: session, error } = await supabase.auth.getUser();
    if (error) console.warn('[cloud] auth lookup failed:', error.message);
    id = session.user?.id;
  } catch (error) {
    console.warn('[cloud] auth lookup unavailable:', error);
  }
  const [catalog, assets, profiles, roles, settings, agencies, hosts, items, notifications, ledger, rooms, audit, userRooms, recharges] = await Promise.all([
    supabase.from('app_catalog').select('*').order('position'),
    id ? supabase.from('app_assets').select('*').order('created_at', { ascending: false }) : none,
    id ? supabase.from('profiles').select('*').order('uid').limit(200) : none,
    id ? supabase.from('user_roles').select('*') : none,
    supabase.from('app_settings').select('*'),
    id ? supabase.from('agencies').select('*') : none,
    id ? supabase.from('agency_hosts').select('*') : none,
    id ? supabase.from('user_items').select('*') : none,
    id ? supabase.from('app_notifications').select('*').order('created_at', { ascending: false }).limit(100) : none,
    id ? supabase.from('coin_ledger').select('*').order('created_at', { ascending: false }).limit(50) : none,
    supabase.from('room_controls').select('*'),
    id ? supabase.from('admin_audit').select('*').order('created_at', { ascending: false }).limit(50) : none,
    id ? supabase.from('rooms').select('*').order('created_at', { ascending: false }).limit(60) : none,
    id ? supabase.from('recharge_requests').select('*').order('created_at', { ascending: false }).limit(100) : none,
  ]);
  // Keep optional backend modules isolated: one missing table/policy must not
  // take down login, the profile, or the room list.
  for (const [name, result] of Object.entries({ catalog, assets, profiles, roles, settings, agencies, hosts, items, notifications, ledger, rooms, audit, userRooms, recharges })) {
    if (result?.error) console.warn(`[cloud] ${name} query failed:`, result.error.message);
  }
  const now = Date.now();
  let url = (path: string) => bundledAssets[path] ?? signed.get(path)?.url ?? '';
  try {
    url = await signMany((assets.data ?? []).map(a => a.path));
  } catch (error) {
    console.warn('[cloud] asset signing unavailable; using bundled fallbacks:', error);
  }
  const art = (assets.data ?? []).map(a => ({ ...a, url: url(a.path) }));
  const ownRoles = (roles.data ?? []).filter(r => r.user_id === id).map(r => r.role);
  const isAdmin = ownRoles.includes('admin');
  const list: CatalogItem[] = (catalog.data ?? []).filter(c => isAdmin || stillValid(c.publish_until, now)).map(c => { const a = art.find(x => x.id === c.asset_id); return { ...c, url: a?.url ?? '', mime: a?.mime ?? '' }; });
  const liveVip = <T extends { vip: number; vip_until: string | null }>(p: T): T => stillValid(p.vip_until, now) ? p : { ...p, vip: 0 };
  const people = (profiles.data ?? []).map(liveVip);
  const own = id ? await supabase.from('profiles').select('*').eq('id', id).maybeSingle() : { data: null };
  const profile = own.data ? liveVip(own.data) : null;
  const roomList: Room[] = (userRooms.data ?? []).map(r => {
    const owner = r.owner_id === id ? profile : people.find(p => p.id === r.owner_id);
    return { id: String(r.room_uid), dbId: r.id, name: r.name, flag: '', vip: owner?.vip ?? 0, online: 0, img: r.cover || owner?.avatar || roomCover, host: owner?.avatar || avatarAt(0), hostId: r.owner_id === id ? 'me' : r.owner_id, badges: [], tag: 'غرفة', notice: r.notice, cloud: true, ownerId: r.owner_id };
  });
  const myRoom = roomList.find(r => r.ownerId === id) ?? null;
  // install before returning so the first render with this data already resolves rooms and art
  installCatalog(list); installRooms(roomList);
  return { profile, roles: ownRoles, catalog: list, assets: art, profiles: people, allRoles: roles.data ?? [], settings: settings.data ?? [], agencies: agencies.data ?? [], hosts: hosts.data ?? [], items: (items.data ?? []).filter(i => stillValid(i.expires_at, now)), notifications: notifications.data ?? [], ledger: ledger.data ?? [], rooms: rooms.data ?? [], audit: audit.data ?? [], roomList, myRoom, recharges: recharges.data ?? [] };
}
export type CloudData = Awaited<ReturnType<typeof fetchCloud>>;
export function useCloud() {
  const auth = useAuth();
  return useQuery({ queryKey: ['cloud', auth?.userId ?? 'public'], queryFn: fetchCloud, staleTime: 10000, refetchInterval: 20000, retry: 1 });
}
export function CloudBridge() {
  const { data } = useCloud();
  useEffect(() => { if (data) { installCatalog(data.catalog); installRooms(data.roomList); publishCloud({ profile: data.profile, roles: data.roles, catalog: data.catalog, assets: data.assets.map(a => ({ asset_key: a.asset_key, url: a.url, mime: a.mime_type })), profiles: data.profiles, items: data.items }); } }, [data]);
  return null;
}
export function useCloudActions() {
  const qc = useQueryClient();
  return async (action: string, payload: Record<string, Json>, done = 'تم حفظ التغيير') => {
    try { await cloudAction(action, payload); await qc.invalidateQueries({ queryKey: ['cloud'] }); if (done) toast.success(done); return true; }
    catch (e) { toast(e instanceof Error ? e.message : 'تعذّر الحفظ'); return false; }
  };
}
export type CatalogInsert = Database['public']['Tables']['app_catalog']['Insert'];
export type AssetRow = CloudData['assets'][number];
