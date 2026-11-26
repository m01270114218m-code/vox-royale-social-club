import { useSyncExternalStore } from 'react';
import type { Database } from '@/integrations/supabase/types';
export type CloudProfile = Database['public']['Tables']['profiles']['Row'];
export type CatalogItem = Database['public']['Tables']['app_catalog']['Row'] & { url: string; mime?: string };
export type CloudAsset = { asset_key: string; url: string; mime?: string | null };
export type CloudState = { profile: CloudProfile | null; roles: string[]; catalog: CatalogItem[]; assets: CloudAsset[]; profiles: CloudProfile[]; items: Database['public']['Tables']['user_items']['Row'][]; equippedItems: Array<{ id: string; user_id: string; catalog_id: string; equipped: boolean; expires_at: string | null }>; follows: Array<{ follower_id: string; following_id: string; created_at: string }> };
const empty: CloudState = { profile: null, roles: [], catalog: [], assets: [], profiles: [], items: [], equippedItems: [], follows: [] };
let state = empty;
const listeners = new Set<() => void>();
export const readCloud = () => state;
export function publishCloud(next: CloudState) { state = next; listeners.forEach(fn => fn()); }
export function useCloudState() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); },readCloud,() => empty); }