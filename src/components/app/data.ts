import ice from "@/assets/ice-bg.jpg";
import room from "@/assets/room-bg.jpg";
import mascot from "@/assets/mascot.jpg";
import a1 from "@/assets/avatars/a1.webp";
import a2 from "@/assets/avatars/a2.webp";
import a3 from "@/assets/avatars/a3.webp";
import a4 from "@/assets/avatars/a4.webp";
import a5 from "@/assets/avatars/a5.webp";
import a6 from "@/assets/avatars/a6.webp";
import a7 from "@/assets/avatars/a7.webp";
import a8 from "@/assets/avatars/a8.webp";
import cHoney from "@/assets/covers/honey.webp";
import cWolf from "@/assets/covers/wolf.webp";
import cDesert from "@/assets/covers/desert.webp";
import cEagle from "@/assets/covers/eagle.webp";
import cCafe from "@/assets/covers/cafe.webp";
import cParis from "@/assets/covers/paris.webp";










import gRose from "@/assets/gifts/rose.webp";
import gDiamond from "@/assets/gifts/diamond.webp";
import gCrown from "@/assets/gifts/crown.webp";
import gFalcon from "@/assets/gifts/falcon.webp";
import gCastle from "@/assets/gifts/castle.webp";
import gRocket from "@/assets/gifts/rocket.webp";
import gChoco from "@/assets/gifts/chocolate.webp";
import gRing from "@/assets/gifts/ring.webp";
import iWallet from "@/assets/icons/wallet.webp";
import iHost from "@/assets/icons/host.webp";
import iTask from "@/assets/icons/task.webp";
import iRewards from "@/assets/icons/rewards.webp";
import iRecharge from "@/assets/icons/recharge.webp";
import iHostAgent from "@/assets/icons/hostagent.webp";
import iBd from "@/assets/icons/bd.webp";
import iShop from "@/assets/icons/shop.webp";
import iLevel from "@/assets/icons/level.webp";
import iBadge from "@/assets/icons/badge.webp";
import iId from "@/assets/icons/idcard.webp";
import uCoin from "@/assets/ui/coin.webp";
import uGem from "@/assets/ui/gem.webp";
import uSeat from "@/assets/ui/seat.webp";
import uCastle from "@/assets/ui/castle.webp";
import uMail from "@/assets/ui/mail.webp";
import uWealth from "@/assets/ui/wealth.webp";
import uRoom from "@/assets/ui/room.webp";
import uCharm from "@/assets/ui/charm.webp";
import sCar from "@/assets/store/car.webp";
import sPegasus from "@/assets/store/pegasus.webp";
import sBubbleGold from "@/assets/store/bubble-gold.webp";
import sBubbleIce from "@/assets/store/bubble-ice.webp";
import sThrone from "@/assets/store/throne.webp";
import sTrophy from "@/assets/store/trophy.webp";
import fWings from "@/assets/frames/wings.webp";
import fIce from "@/assets/frames/ice.webp";
import fRoses from "@/assets/frames/roses.webp";
import fDragon from "@/assets/frames/dragon.webp";
import fObsidian from "@/assets/frames/obsidian.webp";
import fFire from "@/assets/frames/fire.webp";
import fAngel from "@/assets/frames/angel.webp";
import fSapphire from "@/assets/frames/sapphire.webp";
import rOwner from "@/assets/roles/owner.webp";
import rAdmin from "@/assets/roles/admin.webp";
import rMember from "@/assets/roles/member.webp";
import rFan from "@/assets/roles/fan.webp";
import eLion from "@/assets/entries/lion.webp";
import eDragon from "@/assets/entries/dragon.webp";
import eJet from "@/assets/entries/jet.webp";
import eCarriage from "@/assets/entries/carriage.webp";
import { vipArtwork, levelsArtwork } from "./rank-art";

export const images = { ice, room, mascot };
export const avatars = [a1, a2, a3, a4, a5, a6, a7, a8];
export const avatarAt = (i: number) => avatars[((i % 8) + 8) % 8]!;
export const ui = { coin: uCoin, gem: uGem, seat: uSeat, castle: uCastle, mail: uMail, wealth: uWealth, room: uRoom, charm: uCharm };
export const icons = { wallet: iWallet, host: iHost, task: iTask, rewards: iRewards, shop: iShop, level: iLevel, badge: iBadge, id: iId, recharge: iRecharge, hostAgent: iHostAgent, bd: iBd };
export const rankArt = { vip: vipArtwork, level: levelsArtwork };

export type Room = { id: string; dbId?: string; name: string; flag: string; vip: number; online: number; img: string; bg?: string; host: string; hostId: string; badges: string[]; tag: string; notice: string; cloud?: boolean; ownerId?: string };

const notice = "أهلاً بكم في الغرفة. الاحترام أولاً، وممنوع الإساءة أو الإعلانات.";
export const rooms: Room[] = [];
/** Rooms created by real users, keyed by the owner's account ID. Installed by CloudBridge. */
const userRooms = new Map<string, Room>();
export function installRooms(list: readonly Room[]) { userRooms.clear(); for (const r of list) userRooms.set(r.id, r); }
export const liveRooms = (): Room[] => [...userRooms.values()];
export const roomExists = (id: string) => userRooms.has(id) || rooms.some((r) => r.id === id);
export const roomCover = cEagle;
/** Ready-made room pictures offered when creating a room. */
export const roomCovers = [cEagle, cHoney, cWolf, cDesert, cCafe, cParis];
export const roomById = (id: string) => userRooms.get(id) ?? rooms.find((r) => r.id === id) ?? rooms[0]!;

export type FrameKey = "wings" | "ice" | "roses" | "dragon" | "obsidian" | "fire" | "angel" | "sapphire";
export const frames: Record<FrameKey, { n: string; img: string; p: number }> = {
  wings: { n: "أجنحة الملك", img: fWings, p: 30000 },
  ice: { n: "تاج الجليد", img: fIce, p: 12000 },
  roses: { n: "حديقة الورد", img: fRoses, p: 15000 },
  dragon: { n: "التنين البنفسجي", img: fDragon, p: 45000 },
  obsidian: { n: "عرش الياقوت", img: fObsidian, p: 38000 },
  fire: { n: "حلقة النار", img: fFire, p: 26000 },
  angel: { n: "جناح الملاك", img: fAngel, p: 22000 },
  sapphire: { n: "تاج الزفير", img: fSapphire, p: 40000 },
};
export type EntryKey = "lion" | "dragon" | "jet" | "carriage" | "car" | "pegasus";
export const entries: Record<EntryKey, { n: string; img: string; p: number }> = {
  lion: { n: "الأسد الذهبي", img: eLion, p: 60000 },
  dragon: { n: "تنين اللهب", img: eDragon, p: 80000 },
  jet: { n: "الطائرة الخاصة", img: eJet, p: 70000 },
  carriage: { n: "العربة الملكية", img: eCarriage, p: 55000 },
  car: { n: "فيراري حمراء", img: sCar, p: 30000 },
  pegasus: { n: "الحصان المجنح", img: sPegasus, p: 45000 },
};
export type BubbleKey = "none" | "gold" | "ice";
export const bubbles: Record<BubbleKey, { n: string; img: string; cls: string; p: number }> = {
  none: { n: "افتراضية", img: uMail, cls: "bubble-none", p: 0 },
  gold: { n: "فقاعة ذهبية", img: sBubbleGold, cls: "bubble-gold", p: 8000 },
  ice: { n: "فقاعة الجليد", img: sBubbleIce, cls: "bubble-ice", p: 6000 },
};
export type SidTone = "gold" | "red" | "rainbow" | "pink" | "blue";
export const specialIds: { id: string; tone: SidTone; p: number }[] = [
  { id: "8888", tone: "gold", p: 88000 },
  { id: "777", tone: "red", p: 77000 },
  { id: "1000", tone: "rainbow", p: 100000 },
  { id: "520", tone: "pink", p: 52000 },
  { id: "66666", tone: "blue", p: 66000 },
];
/** Each special-ID tone carries its own named badge. */
export const sidBadge: Record<SidTone, string> = { gold: "KING", red: "ACE", rainbow: "LEGEND", pink: "LOVE", blue: "PRO" };
export const sidTone = (id: string | null): SidTone | null => specialIds.find((s) => s.id === id)?.tone ?? null;
export const roleImg = { owner: rOwner, admin: rAdmin, member: rMember, fan: rFan };

export type User = {
  id: string; uid: string; name: string; avatar: string; frame: FrameKey | null; bubble: BubbleKey; entry: EntryKey | null; sid: string | null;
  level: number; vip: number; gender: "m" | "f"; flag: string; bio: string; fans: number; following: number; charm: number; wealth: number; gifts: [number, number][];
};
export const users: User[] = [];


export type Gift = { img: string; n: string; p: number };
export const gifts: Gift[] = [];

export type StoreKind = "frame" | "entry" | "bubble" | "sid" | "seat";
export type StoreItem = { key: string; kind: StoreKind; img: string; n: string; p: number; days: number };
export const storeCats: { k: StoreKind | "all"; n: string }[] = [
  { k: "all", n: "الكل" }, { k: "frame", n: "إطارات" }, { k: "entry", n: "دخوليات" }, { k: "bubble", n: "فقاعات" }, { k: "sid", n: "أرقام مميزة" }, { k: "seat", n: "مقاعد" },
];
export const storeItems: StoreItem[] = [
  ...(Object.keys(frames) as FrameKey[]).map((k) => ({ key: `frame:${k}`, kind: "frame" as const, img: frames[k].img, n: frames[k].n, p: frames[k].p, days: 7 })),
  ...(Object.keys(entries) as EntryKey[]).map((k) => ({ key: `entry:${k}`, kind: "entry" as const, img: entries[k].img, n: entries[k].n, p: entries[k].p, days: 7 })),
  ...(["gold", "ice"] as BubbleKey[]).map((k) => ({ key: `bubble:${k}`, kind: "bubble" as const, img: bubbles[k].img, n: bubbles[k].n, p: bubbles[k].p, days: 7 })),
  ...specialIds.map((s) => ({ key: `sid:${s.id}`, kind: "sid" as const, img: iId, n: `ID ${s.id}`, p: s.p, days: 30 })),
  { key: "seat:throne", kind: "seat", img: sThrone, n: "عرش الجليد", p: 25000, days: 7 },
  { key: "seat:trophy", kind: "seat", img: sTrophy, n: "كأس الأبطال", p: 20000, days: 7 },
];

/* ---------- animated emoji (room) ---------- */
import emJoy from "@/assets/emoji/joy.webp";
import emLove from "@/assets/emoji/love.webp";
import emFire from "@/assets/emoji/fire.webp";
import emHeart from "@/assets/emoji/heart.webp";
import emClap from "@/assets/emoji/clap.webp";
import emParty from "@/assets/emoji/party.webp";
import emCool from "@/assets/emoji/cool.webp";
import emCry from "@/assets/emoji/cry.webp";
import emKiss from "@/assets/emoji/kiss.webp";
import emRofl from "@/assets/emoji/rofl.webp";
import emLike from "@/assets/emoji/like.webp";
import emRose from "@/assets/emoji/rose.webp";
export const emojis: { k: string; img: string }[] = [
  { k: "joy", img: emJoy }, { k: "rofl", img: emRofl }, { k: "love", img: emLove }, { k: "kiss", img: emKiss },
  { k: "heart", img: emHeart }, { k: "fire", img: emFire }, { k: "clap", img: emClap }, { k: "party", img: emParty },
  { k: "cool", img: emCool }, { k: "cry", img: emCry }, { k: "like", img: emLike }, { k: "rose", img: emRose },
];

/* ---------- login media ---------- */
import loginVideo from "@/assets/media/ice_palace_login.mp4.asset.json";
import loginPoster from "@/assets/media/login-poster.jpg";
// The Android build bundles the video locally and sets VITE_LOGIN_VIDEO.
export const loginMedia = { video: (import.meta.env["VITE_LOGIN_VIDEO"] as string | undefined) ?? loginVideo.url, poster: loginPoster };

/* ---------- gift categories ---------- */
export type GiftTab = "static" | "animated" | "lucky";
export type ShopGift = Gift & { lucky?: boolean; id?: string; animated?: boolean; full?: boolean; mime?: string; soundUrl?: string; bannerStyle?: "glass"|"luxury"|"minimal"|"neon" };
export const luckyGifts: ShopGift[] = [];
/** Total value (price × quantity) at which a gift is broadcast as a luxury banner across rooms. */
export const LUXURY_BANNER_MIN = 5000;
/** Special animated video gifts (falcon flight, ice castle) shown fullscreen when sent. */
export const videoGifts: ShopGift[] = [];
export const giftTabs: { k: GiftTab; n: string; list: ShopGift[] }[] = [
  { k: "static", n: "ثابتة", list: gifts.filter((g) => g.p < 1000) },
  { k: "animated", n: "فاخرة", list: [...gifts.filter((g) => g.p >= 1000), ...videoGifts] },
  { k: "lucky", n: "حظ", list: luckyGifts },
];

/* ---------- badges ---------- */
export const badgeArt = { vip: iBadge, level: iLevel, owner: rOwner, admin: rAdmin, fan: rFan, member: rMember, host: iHost, wealth: uWealth, charm: uCharm, id: iId, gift: gCrown, rocket: gRocket, castle: gCastle, task: iTask };
export const bundledAssets:Record<string,string>={
  'bundled/emoji/heart':emHeart,'bundled/emoji/kiss':emKiss,'bundled/emoji/fire':emFire,'bundled/emoji/party':emParty,'bundled/emoji/rose':emRose,
  ...Object.fromEntries(Object.entries(frames).map(([key,value])=>[`bundled/frame/${key}`,value.img])),
  ...Object.fromEntries(Object.entries(entries).map(([key,value])=>[`bundled/entry/${key}`,value.img])),
  'bundled/bubble/gold':sBubbleGold,'bundled/bubble/ice':sBubbleIce,'bundled/seat/throne':sThrone,'bundled/seat/trophy':sTrophy,'bundled/sid':iId,
};
export function installCatalog(list: readonly {id:string;kind:string;name:string;url:string;price:number;enabled:boolean;description:string;metadata?:unknown}[]) {
  // The room/store UI is cloud-authoritative. Local bundled catalog entries are never
  // promoted into the live catalog; only rows returned by Supabase can be displayed.
  for(const c of list.filter(c=>c.enabled&&c.url)) {
    const key=`cloud-${c.id}`;
    if(c.kind==='frame')Object.assign(frames,{[key]:{n:c.name,img:c.url,p:c.price}});
    if(c.kind==='entry')Object.assign(entries,{[key]:{n:c.name,img:c.url,p:c.price}});
    if(c.kind==='bubble')Object.assign(bubbles,{[key]:{n:c.name,img:c.url,p:c.price,cls:'bubble-ice'}});
  }
  const custom=list.filter(c=>c.kind==='gift'&&c.enabled&&c.url).map(c=>{
    const meta=(c.metadata && typeof c.metadata === "object" && !Array.isArray(c.metadata) ? c.metadata : {}) as Record<string, unknown>;
    return {img:c.url,n:c.name,p:c.price,id:c.id, animated:meta['type']==='animated', lucky:meta['type']==='lucky', full:meta['full']===true, bannerStyle: (meta["banner_style"]==="luxury"||meta["banner_style"]==="minimal"||meta["banner_style"]==="neon"||meta["banner_style"]==="glass") ? meta["banner_style"] as "luxury"|"minimal"|"neon"|"glass" : "luxury"};
  });
  const staticGifts=custom.filter(g=>!g.lucky&&!g.animated);
  const animatedGifts=custom.filter(g=>g.animated&&!g.lucky);
  const lucky=custom.filter(g=>g.lucky);
  for(const tab of giftTabs) {
    tab.list = tab.k==='lucky' ? lucky : tab.k==='animated' ? animatedGifts : staticGifts;
  }
}
