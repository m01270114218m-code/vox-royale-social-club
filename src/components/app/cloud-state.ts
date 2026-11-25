import { useSyncExternalStore } from 'react';
import type { Database } from '@/integrations/supabase/types';
export type CloudProfile = Database['public']['Tables']['profiles']['Row'];
export type CatalogItem = Database['public']['Tables']['app_catalog']['Row'] & { url: string; mime?: string };
export type CloudState = { profile: CloudProfile | null; roles: string[]; catalog: CatalogItem[]; profiles: CloudProfile[]; items: Database['public']['Tables']['user_items']['Row'][] };
const empty: CloudState = { profile: null, roles: [], catalog: [], profiles: [],items:[] };
let state = empty;
const listeners = new Set<() => void>();
export const readCloud = () => state;
export function publishCloud(next: CloudState) { state = next; listeners.forEach(fn => fn()); }
export function useCloudState() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); },readCloud,() => empty); }