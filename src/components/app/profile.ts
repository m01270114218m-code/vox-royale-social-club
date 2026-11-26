import { useSyncExternalStore } from "react";
import { avatarAt, type BubbleKey, type EntryKey, type FrameKey, type StoreItem, type User } from "./data";
import { readCloud, useCloudState } from './cloud-state';

export type Profile = {
  name: string;
  bio: string;
  gender: "m" | "f";
  flag: string;
  avatar: number;
  customAvatar: string | null;
  frame: FrameKey | null;
  bubble: BubbleKey;
  entry: EntryKey | null;
  sid: string | null;
  coins: number;
  diamonds: number;
  owned: string[];
  following: string[];
  stats: Stats;
  roomMedia: Record<string, { name?: string; notice?: string; cover?: string | null; bg?: string | null }>;
  dms: Record<string, { id: number; from: "me" | "them"; text: string; at: string }[]>;
  agentEnabled: boolean;
  bdEnabled: boolean;
  agencies: Agency[];
  linked: { google: boolean; facebook: boolean; phone: boolean };
  notify: boolean;
};

export type DayStat = { app: number; mic: number; gifts: number };
export type Stats = { giftsOut: number; days: Record<string, DayStat> };
export type AgencyPerm = "inviteHosts" | "removeHosts" | "viewIncome" | "withdraw";
export const agencyPermLabel: Record<AgencyPerm, string> = { inviteHosts: "دعوة مضيفين", removeHosts: "إزالة مضيفين", viewIncome: "عرض الدخل", withdraw: "سحب الأرباح" };
export type Agency = { id: string; name: string; agentUid: string; hosts: string[]; perms: AgencyPerm[]; createdAt: string };

export const defaultProfile: Profile = {
  name: "مستخدم جديد",
  bio: "",
  gender: "m",
  flag: "",
  avatar: 0,
  customAvatar: null,
  frame: null,
  bubble: "none",
  entry: null,
  sid: null,
  coins: 0,
  diamonds: 0,
  owned: [],
  following: [],
  stats: { giftsOut: 0, days: {} },
  roomMedia: {},
  dms: {},
  agentEnabled: false,
  bdEnabled: false,
  agencies: [],
  linked: { google: false, facebook: false, phone: false },
  notify: true,
};

const KEY = "frost-profile-v1";
let state: Profile = defaultProfile;
let loaded = false;
const listeners = new Set<() => void>();

function read(): Profile {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) state = { ...defaultProfile, ...(JSON.parse(raw) as Partial<Profile>) };
      state = { ...state, stats: { ...defaultProfile.stats, ...state.stats } };
    } catch {
      /* ignore corrupt storage */
    }
  }
  return state;
}

export function setProfile(patch: Partial<Profile> | ((p: Profile) => Partial<Profile>)) {
  const cur = read();
  state = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useProfile(): Profile {
  const cloud=useCloudState();
  const local=useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => defaultProfile,
  );
  if(!cloud.profile)return local;
  const own=cloud.items.filter(i=>i.user_id===cloud.profile?.id&&i.equipped);
  const worn=(kind:string)=>cloud.catalog.find(c=>c.kind===kind&&own.some(i=>i.catalog_id===c.id));
  return {...local,following:cloud.follows.filter(f=>f.follower_id===cloud.profile?.id).map(f=>f.following_id),name:cloud.profile.name??local.name,bio:cloud.profile.bio??local.bio,avatar:0,customAvatar:null,owned:[],roomMedia:{},dms:{},coins:cloud.profile.coins??local.coins,diamonds:cloud.profile.diamonds??local.diamonds,sid:cloud.profile.special_id,agentEnabled:cloud.roles.includes('host_agent'),bdEnabled:cloud.roles.includes('bd'),frame:worn('frame')?`cloud-${worn('frame')?.id}` as FrameKey:null,entry:worn('entry')?`cloud-${worn('entry')?.id}` as EntryKey:null,bubble:worn('bubble')?`cloud-${worn('bubble')?.id}` as BubbleKey:'none'};
}

export const MY_UID = "1031437";

/** The signed-in user expressed in the same shape as other members. */
export function meAsUser(p: Profile): User {
  const giftsIn = Object.values(p.stats.days).reduce((s, d) => s + d.gifts, 0);
  const cloud = readCloud().profile;
  return {
    id: "me", uid: cloud ? String(cloud.uid) : MY_UID, name: cloud?.name ?? p.name, avatar: cloud?.avatar_url || cloud?.avatar || p.customAvatar || avatarAt(p.avatar), frame: (() => { const item=readCloud().equippedItems.find(i=>i.user_id===cloud?.id&&readCloud().catalog.some(c=>c.id===i.catalog_id&&c.kind==="frame"&&c.enabled)); return item ? ("cloud-"+item.catalog_id) as FrameKey : p.frame; })(), bubble: (() => { const item=readCloud().equippedItems.find(i=>i.user_id===cloud?.id&&readCloud().catalog.some(c=>c.id===i.catalog_id&&c.kind==="bubble"&&c.enabled)); return item ? ("cloud-"+item.catalog_id) as BubbleKey : p.bubble; })(), entry: (() => { const item=readCloud().equippedItems.find(i=>i.user_id===cloud?.id&&readCloud().catalog.some(c=>c.id===i.catalog_id&&c.kind==="entry"&&c.enabled)); return item ? ("cloud-"+item.catalog_id) as EntryKey : p.entry; })(), sid: cloud?.special_id ?? p.sid,
    level: cloud?.level ?? 1, vip: cloud?.vip ?? 0, gender: p.gender, flag: p.flag, bio: cloud?.bio ?? p.bio, fans: readCloud().follows.filter(f=>f.following_id===cloud?.id).length, following: readCloud().follows.filter(f=>f.follower_id===cloud?.id).length, charm: cloud?.gift_value ?? giftsIn, wealth: cloud?.coins ?? p.coins, gifts: [],
  };
}

/** Resolve the user's current avatar URL (device upload or preset). */
export function profileAvatar(p: Profile): string {
  return readCloud().profile?.avatar_url || readCloud().profile?.avatar || p.customAvatar || avatarAt(p.avatar);
}

/** Save custom room name, notice, cover photo, or background photo. */
export function setRoomMedia(roomId: string, patch: { name?: string; notice?: string; cover?: string | null; bg?: string | null }) {
  setProfile((p) => ({
    roomMedia: {
      ...p.roomMedia,
      [roomId]: { ...p.roomMedia[roomId], ...patch },
    },
  }));
}

/** Send a private message to a user and persist it locally. */
export function sendDm(uid: string, text: string) {
  const clean = text.trim();
  if (!clean) return;
  const now = new Date();
  const at = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  setProfile((p) => ({
    dms: {
      ...p.dms,
      [uid]: [...(p.dms[uid] ?? []), { id: Date.now(), from: "me", text: clean, at }],
    },
  }));
}

export function findUser(id: string, p: Profile): User | undefined {
  const cloud=readCloud();
  const row=cloud.profiles.find(u=>u.id===id||String(u.uid)===id);
  if(row){const own=cloud.equippedItems.filter(i=>i.user_id===row.id);const worn=(kind:string)=>cloud.catalog.find(c=>c.kind===kind&&c.enabled&&own.some(i=>i.catalog_id===c.id));return {id:row.id,uid:String(row.uid),name:row.name,avatar:row.avatar_url||row.avatar||avatarAt(0),frame:worn('frame')?`cloud-${worn('frame')?.id}` as FrameKey:null,entry:worn('entry')?`cloud-${worn('entry')?.id}` as EntryKey:null,bubble:worn('bubble')?`cloud-${worn('bubble')?.id}` as BubbleKey:'none',sid:row.special_id,level:row.level,vip:row.vip,gender:'m',flag:'',bio:row.bio,fans:cloud.follows.filter(f=>f.following_id===row.id).length,following:cloud.follows.filter(f=>f.follower_id===row.id).length,charm:row.gift_value,wealth:row.coins,gifts:[]};}
  return id === "me" ? meAsUser(p) : undefined;
}

/** Apply an owned store item to the profile. */
export function equipPatch(item: StoreItem): Partial<Profile> {
  const [kind, val] = item.key.split(":") as [string, string];
  if (kind === "frame") return { frame: val as FrameKey };
  if (kind === "entry") return { entry: val as EntryKey };
  if (kind === "bubble") return { bubble: val as BubbleKey };
  if (kind === "sid") return { sid: val };
  return {};
}

export type BuyResult = "bought" | "owned" | "poor";
export function buyResult(p: Profile, item: StoreItem): BuyResult {
  if (p.owned.includes(item.key)) return "owned";
  return p.coins >= item.p ? "bought" : "poor";
}

export function buy(item: StoreItem): BuyResult {
  const p = read();
  const r = buyResult(p, item);
  if (r === "bought") setProfile({ coins: p.coins - item.p, owned: [...p.owned, item.key], ...equipPatch(item) });
  return r;
}

export function isEquipped(p: Profile, item: StoreItem) {
  const patch = equipPatch(item) as Record<string, unknown>;
  const k = Object.keys(patch)[0];
  return !!k && (p as unknown as Record<string, unknown>)[k] === patch[k];
}

export function spendCoins(n: number): boolean {
  const p = read();
  if (p.coins < n) return false;
  setProfile({ coins: p.coins - n, stats: { ...p.stats, giftsOut: p.stats.giftsOut + n } });
  return true;
}

export function toggleFollow(uid: string): boolean {
  const p = read();
  const on = !p.following.includes(uid);
  setProfile({ following: on ? [...p.following, uid] : p.following.filter((x) => x !== uid) });
  return on;
}

/* ---------- activity stats (host center) ---------- */
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export function addStatTo(p: Profile, kind: keyof DayStat, n: number, day = dayKey()): Partial<Profile> {
  const cur = p.stats.days[day] ?? { app: 0, mic: 0, gifts: 0 };
  return { stats: { ...p.stats, days: { ...p.stats.days, [day]: { ...cur, [kind]: cur[kind] + n } } } };
}
export function addStat(kind: keyof DayStat, n: number) {
  setProfile((p) => addStatTo(p, kind, n));
}
/** Sum stats over the last `days` days including today. */
export function sumStats(p: Profile, days: number, now = new Date()): DayStat {
  const out = { app: 0, mic: 0, gifts: 0 };
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const s = p.stats.days[dayKey(d)];
    if (s) { out.app += s.app; out.mic += s.mic; out.gifts += s.gifts; }
  }
  return out;
}

/* ---------- BD center: agencies ---------- */
export type AgencyResult = "ok" | "disabled" | "name" | "duplicate";
export function createAgencyFrom(p: Profile, name: string, agentUid: string): { r: AgencyResult; patch?: Partial<Profile> } {
  if (!p.bdEnabled) return { r: "disabled" };
  const n = name.trim();
  if (n.length < 3) return { r: "name" };
  if (p.agencies.some((a) => a.name === n)) return { r: "duplicate" };
  const a: Agency = { id: `ag${Date.now()}`, name: n, agentUid: agentUid.trim() || MY_UID, hosts: [], perms: ["inviteHosts", "viewIncome"], createdAt: dayKey() };
  return { r: "ok", patch: { agencies: [...p.agencies, a] } };
}
export function createAgency(name: string, agentUid: string): AgencyResult {
  const res = createAgencyFrom(read(), name, agentUid);
  if (res.patch) setProfile(res.patch);
  return res.r;
}
export function updateAgency(id: string, f: (a: Agency) => Agency) {
  setProfile((p) => ({ agencies: p.agencies.map((a) => (a.id === id ? f(a) : a)) }));
}

/** Wipe every local record for this account (used by "delete my account"). */
export function resetProfile() {
  state = defaultProfile;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
