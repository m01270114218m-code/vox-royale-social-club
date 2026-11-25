export type CloudProfile = { id:string; uid:string; name:string; bio:string; avatar:string; level:number; vip:number; vip_until:string|null; special_id:string|null; coins:number; diamonds:number; gift_value:number };
export type CatalogItem = { id:string; asset_id:string; kind:string; price:number; position:number; publish_until:string|null; name:string; title:string; description:string; link:string; rank:number; enabled:boolean; metadata:Record<string,unknown>; url:string; mime?:string };
export type CloudItem = { id:string; user_id:string; catalog_id:string; equipped:boolean; expires_at:string|null };
export type CloudState = { profile:CloudProfile|null; roles:string[]; catalog:CatalogItem[]; profiles:CloudProfile[]; items:CloudItem[] };
const empty: CloudState = { profile:null, roles:[], catalog:[], profiles:[], items:[] };
let state=empty;
const listeners=new Set<()=>void>();
export const readCloud=()=>state;
export function publishCloud(next:CloudState){state=next;listeners.forEach(fn=>fn());}
export function useCloudState(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},readCloud,()=>empty);}
import { useSyncExternalStore } from "react";
