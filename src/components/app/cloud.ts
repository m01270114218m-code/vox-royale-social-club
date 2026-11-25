import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { publishCloud } from "./cloud-state";
import { useAuth } from "./session";
import { toast } from "./toast";
import { installCatalog, installRooms, bundledAssets, avatarAt, roomCover, type Room } from "./data";
import { stillValid } from "./daily";

export async function cloudAction(action: string, _payload: Record<string, unknown>) { throw new Error("الإجراء السحابي غير متاح بعد: " + action); }
const signed = new Map<string, { url: string; until: number }>();
const SIGN_SECONDS = 6 * 3600;
export async function signMany(paths: string[]) {
  const now = Date.now();
  const need = [...new Set(paths)].filter(p => p && !bundledAssets[p] && (signed.get(p)?.until ?? 0) < now);
  if (need.length) { const { data, error } = await supabase.storage.from("app-assets").createSignedUrls(need, SIGN_SECONDS); if (error) throw new Error(error.message); for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, { url: row.signedUrl, until: now + (SIGN_SECONDS - 600) * 1000 }); }
  return (path: string) => bundledAssets[path] ?? signed.get(path)?.url ?? "";
}
export async function signedAsset(path: string) { return path ? (await signMany([path]))(path) : ""; }
type ProfileRow = { id:string; uid:string; name:string; bio:string; avatar:string; level:number; vip:number; vip_until:string|null; special_id:string|null; coins:number; diamonds:number; gift_value:number };
type ItemRow = { id:string; user_id:string; catalog_id:string; equipped:boolean; expires_at:string|null };
type AssetRow = { id:string; path:string; mime:string; title:string; name:string; category:string; section:string; metadata:Record<string,unknown>; url?:string };
type CatalogRow = { id:string; asset_id:string; kind:string; price:number; position:number; publish_until:string|null; title:string; name:string; description:string; link:string; rank:number; enabled:boolean; metadata:Record<string,unknown>; url:string; mime:string };

export async function fetchCloud() {
  const { data: authData } = await supabase.auth.getUser(); const id = authData.user?.id;
  const [assetsRes, profilesRes, rolesRes, settingsRes, agenciesRes, inventoryRes, notificationsRes, ledgerRes, roomsRes, auditRes, walletRes, vipsRes, membersRes] = await Promise.all([
    supabase.from("app_assets").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("admin_roles").select("*"),
    supabase.from("app_settings").select("*"),
    supabase.from("agencies").select("*"),
    id ? supabase.from("user_inventory").select("*").eq("user_id", id) : Promise.resolve({ data: [], error: null }),
    id ? supabase.from("notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    id ? supabase.from("wallet_transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    supabase.from("rooms").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(100),
    id ? supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    id ? supabase.from("wallets").select("*").eq("user_id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("user_vips").select("*"),
    supabase.from("room_members").select("room_id,user_id"),
  ]);
  for (const r of [assetsRes,profilesRes,rolesRes,settingsRes,agenciesRes,inventoryRes,notificationsRes,ledgerRes,roomsRes,auditRes,walletRes,vipsRes,membersRes]) if (r.error) throw new Error(r.error.message);
  const rawAssets = (assetsRes.data ?? []) as Array<Record<string,unknown>>;
  const getUrl = await signMany(rawAssets.map(a => String(a.storage_path ?? "")));
  const assets: AssetRow[] = rawAssets.map(a => ({ id:String(a.id), path:String(a.storage_path ?? ""), mime:String(a.mime_type ?? ""), title:String(a.title ?? ""), category:String(a.category ?? ""), metadata:(a.metadata ?? {}) as Record<string,unknown>, name:String(a.title ?? ""), section:String(a.category ?? ""), url:getUrl(String(a.storage_path ?? "")) }));
  const vipByUser = new Map<string,{vip:number;until:string}>();
  for (const v of (vipsRes.data ?? []) as Array<Record<string,unknown>>) { const until=String(v.expires_at ?? ""); if(until && new Date(until).getTime()>Date.now()) vipByUser.set(String(v.user_id),{vip:1,until}); }
  const people: ProfileRow[] = ((profilesRes.data ?? []) as Array<Record<string,unknown>>).map(p => { const v=vipByUser.get(String(p.id)); const meta=(p.metadata ?? {}) as Record<string,unknown>; return { id:String(p.id), uid:String(p.public_id ?? p.id), name:String(p.display_name ?? ""), bio:String(p.bio ?? ""), avatar:String(p.avatar_url ?? ""), level:Number(p.level ?? 1), vip:v?.vip ?? 0, vip_until:v?.until ?? null, special_id:p.public_id?String(p.public_id):null, coins:0, diamonds:0, gift_value:Number(meta.gift_value ?? 0) }; });
  if(id && walletRes.data){ const own=people.find(p=>p.id===id); const w=walletRes.data as Record<string,unknown>; if(own){own.coins=Number(w.coins??0);own.diamonds=Number(w.diamonds??0);} }
  const roles=((rolesRes.data ?? []) as Array<Record<string,unknown>>).map(r=>({user_id:String(r.user_id),role:String(r.role)}));
  const ownRoles=roles.filter(r=>r.user_id===id).map(r=>r.role); const isAdmin=ownRoles.includes("admin")||ownRoles.includes("super_admin");
  const catalog: CatalogRow[]=assets.map((a,i)=>{const m=a.metadata;return {id:a.id,asset_id:a.id,kind:String(m.kind??a.category),price:Number(m.price??0),position:Number(m.position??i),publish_until:typeof m.publish_until==="string"?m.publish_until:null,title:a.title,name:a.title,description:String(m.description??""),link:String(m.link??a.url??""),rank:Number(m.rank??0),enabled:true,metadata:m,url:a.url??"",mime:a.mime};}).filter(c=>isAdmin||stillValid(c.publish_until,Date.now()));
  const items: ItemRow[]=((inventoryRes.data ?? []) as Array<Record<string,unknown>>).map(i=>({id:String(i.id),user_id:String(i.user_id),catalog_id:String(i.item_id),equipped:Boolean(((i.metadata??{}) as Record<string,unknown>).equipped),expires_at:i.expires_at?String(i.expires_at):null})).filter(i=>stillValid(i.expires_at,Date.now()));
  const members=(membersRes.data ?? []) as Array<Record<string,unknown>>;
  const roomList: Room[]=((roomsRes.data ?? []) as Array<Record<string,unknown>>).map(r=>{const ownerId=String(r.owner_id);const owner=people.find(p=>p.id===ownerId);return {id:String(r.id),name:String(r.title??""),flag:"",vip:owner?.vip??0,online:members.filter(m=>String(m.room_id)===String(r.id)).length,img:String(r.cover_url??owner?.avatar??roomCover),host:owner?.avatar||avatarAt(0),hostId:ownerId,badges:[],tag:String(r.room_type??"غرفة"),notice:String(r.description??""),cloud:true,ownerId};});
  const profile=id?people.find(p=>p.id===id)??null:null;roomList.find(r=>r.ownerId===id)??null;
  installCatalog(catalog as never); installRooms(roomList);
  const ledger=((ledgerRes.data ?? []) as Array<Record<string,unknown>>).map(x=>({ ...x, sender_id:null, recipient_id:id, kind:String(x.transaction_type??"transaction"), amount:Number(x.amount??0) })); const myRoom=roomList.find(r=>r.ownerId===id)??null; return {profile,roles:ownRoles,catalog,assets,profiles:people,allRoles:roles,settings:settingsRes.data??[],agencies:agenciesRes.data??[],hosts:[],items,notifications:notificationsRes.data??[],ledger,rooms:(roomsRes.data??[]) as any[],audit:(auditRes.data??[]) as any[],roomList,myRoom,recharges:[] as any[]};
}
export type CloudData=Awaited<ReturnType<typeof fetchCloud>>;
export function useCloud(){const auth=useAuth();return useQuery({queryKey:["cloud",auth?.userId??"public"],queryFn:fetchCloud,staleTime:10000,refetchInterval:20000,retry:1});}
export function CloudBridge(){const {data}=useCloud();useEffect(()=>{if(data){installCatalog(data.catalog as never);installRooms(data.roomList);publishCloud({profile:data.profile,roles:data.roles,catalog:data.catalog,profiles:data.profiles,items:data.items});}},[data]);return null;}
export function useCloudActions(){const qc=useQueryClient();return async(action:string,payload:Record<string,unknown>,done="تم حفظ التغيير")=>{try{await cloudAction(action,payload);await qc.invalidateQueries({queryKey:["cloud"]});if(done)toast.success(done);return true;}catch(e){toast(e instanceof Error?e.message:"تعذّر الحفظ");return false;}};}
export type CatalogInsert=CatalogRow;