import home from "@/assets/3d/rendered/home.png";
import explore from "@/assets/3d/rendered/explore.png";
import friends from "@/assets/3d/rendered/friends.png";
import messages from "@/assets/3d/rendered/messages.png";
import profile from "@/assets/3d/rendered/profile.png";
import store from "@/assets/3d/rendered/store.png";
import wallet from "@/assets/3d/rendered/wallet.png";
import vip from "@/assets/3d/rendered/vip.png";
import family from "@/assets/3d/rendered/family.png";
import support from "@/assets/3d/rendered/support.png";
import bell from "@/assets/3d/rendered/bell.png";
import gear from "@/assets/3d/rendered/gear.png";
import search from "@/assets/3d/rendered/search.png";
import giftbox from "@/assets/3d/rendered/giftbox.png";
import plus from "@/assets/3d/rendered/plus.png";
import back from "@/assets/3d/rendered/back.png";
import share from "@/assets/3d/rendered/share.png";
import send from "@/assets/3d/rendered/send.png";
import trash from "@/assets/3d/rendered/trash.png";
import logout from "@/assets/3d/rendered/logout.png";
import rose from "@/assets/3d/rendered/rose.png";
import heart from "@/assets/3d/rendered/heart.png";
import crown from "@/assets/3d/rendered/crown.png";
import ring from "@/assets/3d/rendered/ring.png";
import car from "@/assets/3d/rendered/car.png";
import castle from "@/assets/3d/rendered/castle.png";
import rocket from "@/assets/3d/rendered/rocket.png";
import chest from "@/assets/3d/rendered/chest.png";
import mic from "@/assets/3d/rendered/mic.png";
import mic_host from "@/assets/3d/rendered/mic-host.png";
import mic_muted from "@/assets/3d/rendered/mic-muted.png";
import mic_locked from "@/assets/3d/rendered/mic-locked.png";
import diamond from "@/assets/3d/rendered/diamond.png";
import coin from "@/assets/3d/rendered/coin.png";
import frame1 from "@/assets/3d/rendered/frame-1.png";
import frame2 from "@/assets/3d/rendered/frame-2.png";
import frame3 from "@/assets/3d/rendered/frame-3.png";
import frame4 from "@/assets/3d/rendered/frame-4.png";
import frame5 from "@/assets/3d/rendered/frame-5.png";
import frame6 from "@/assets/3d/rendered/frame-6.png";
import vip1 from "@/assets/3d/rendered/vip-1.png";
import vip2 from "@/assets/3d/rendered/vip-2.png";
import vip3 from "@/assets/3d/rendered/vip-3.png";
import vip4 from "@/assets/3d/rendered/vip-4.png";
import vip5 from "@/assets/3d/rendered/vip-5.png";
import vip6 from "@/assets/3d/rendered/vip-6.png";
import level1 from "@/assets/3d/rendered/level-1.png";
import level2 from "@/assets/3d/rendered/level-2.png";
import level3 from "@/assets/3d/rendered/level-3.png";
import level4 from "@/assets/3d/rendered/level-4.png";
import level5 from "@/assets/3d/rendered/level-5.png";
import level6 from "@/assets/3d/rendered/level-6.png";
import room_royal from "@/assets/3d/rendered/room-royal.jpg";
import room_tropical from "@/assets/3d/rendered/room-tropical.jpg";
import room_music from "@/assets/3d/rendered/room-music.jpg";
import room_garden from "@/assets/3d/rendered/room-garden.jpg";
import newFrame1 from "@/assets/3d/new/frame-1.svg";
import newFrame2 from "@/assets/3d/new/frame-2.svg";
import newFrame3 from "@/assets/3d/new/frame-3.svg";
import newFrame4 from "@/assets/3d/new/frame-4.svg";
import newFrame5 from "@/assets/3d/new/frame-5.svg";
import newEntry1 from "@/assets/3d/new/entry-1.svg";
import newEntry2 from "@/assets/3d/new/entry-2.svg";
import newEntry3 from "@/assets/3d/new/entry-3.svg";
import newEntry4 from "@/assets/3d/new/entry-4.svg";
import newEntry5 from "@/assets/3d/new/entry-5.svg";
import newGift1 from "@/assets/3d/new/gift-1.svg";
import newGift2 from "@/assets/3d/new/gift-2.svg";
import newGift3 from "@/assets/3d/new/gift-3.svg";
import newGift4 from "@/assets/3d/new/gift-4.svg";
import newGift5 from "@/assets/3d/new/gift-5.svg";

export const icons3d = { home, explore, friends, messages, profile, store, wallet, vip, family, support, bell, gear, search, giftbox, plus, back, share, send, trash, logout, rose, heart, crown, ring, car, castle, rocket, chest, mic, diamond, coin, agency: family, micHost: mic_host, micMuted: mic_muted, micLocked: mic_locked };
const frames = [frame1, frame2, frame3, frame4, frame5, frame6];
export const independentFrames = [newFrame1, newFrame2, newFrame3, newFrame4, newFrame5];
export const independentEntries = [newEntry1, newEntry2, newEntry3, newEntry4, newEntry5];
export const independentGifts = [newGift1, newGift2, newGift3, newGift4, newGift5];
const vips = [vip1, vip2, vip3, vip4, vip5, vip6];
const levels = [level1, level2, level3, level4, level5, level6];
export function avatarFrame(vip: number) { return vip > 0 ? frames[Math.min(5, Math.max(0, Math.floor(vip) - 1))] : undefined; }
export function frameByKey(key?: string | null) {
  if (key?.startsWith("frame-independent-")) { const n = Number(key.split("-").pop()); return Number.isFinite(n) && n >= 1 && n <= 5 ? independentFrames[n - 1] : undefined; }
  if (!key) return undefined;
  const match = key.match(/^frame-(\d+)/);
  const n = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(n) || n < 1) return undefined;
  return frames[(n - 1) % frames.length];
}
export const entryEffects: Record<string, { name: string; image: string }> = {
  "entry-bolt": { name: "دخولية البرق", image: diamond },
  "entry-car": { name: "دخولية السيارة", image: car },
  "entry-rocket": { name: "دخولية الصاروخ", image: rocket },
  "entry-dragon": { name: "دخولية التنين", image: castle },
  "entry-star": { name: "دخولية النجوم", image: crown },
  "entry-diamond": { name: "دخولية الماس", image: diamond },
  "entry-castle": { name: "دخولية القصر", image: castle },
  "entry-rocket-animated": { name: "دخولية الصاروخ المتحرك", image: rocket },
  "entry-dragon-animated": { name: "دخولية التنين المتحرك", image: castle },
  "entry-diamond-animated": { name: "دخولية الماس المتحرك", image: diamond },
};
export function vipBadge(vip: number) { return vip > 0 ? vips[Math.min(5, Math.max(0, Math.floor(vip) - 1))] : undefined; }
export function levelBadge(level: number) { return levels[Math.min(5, Math.max(0, Math.floor((level - 1) / 10)))]; }
export const roomThemes = [{ id: "royal", name: "القصر الملكي", image: room_royal }, { id: "tropical", name: "الجزيرة", image: room_tropical }, { id: "music", name: "استوديو الموسيقى", image: room_music }, { id: "garden", name: "الحديقة", image: room_garden }];
export function roomBackground(category: string) { return (roomThemes.find(t => t.id === ({ music: "music", friends: "tropical", poetry: "garden" } as Record<string, string>)[category]) ?? roomThemes[0])?.image ?? room_royal; }
const byName: Record<string, string> = { "وردة": rose, "قلب": heart, "تاج": crown, "خاتم": ring, "سيارة": car, "قلعة": castle, "صاروخ": rocket, "صندوق": chest, "ماسة": diamond };
const byEmoji: Record<string, string> = { "🌹": rose, "💖": heart, "👑": crown, "💍": ring, "🏎️": car, "🏰": castle, "🚀": rocket, "💎": diamond, "🎁": giftbox };
export function giftImage(name?: string, emoji?: string) { const m = name?.match(/هدية مستقلة (\\d+)/); if (m) return independentGifts[Number(m[1]) - 1] || giftbox; return (name && byName[name.trim()]) || (emoji && byEmoji[emoji]) || giftbox; }
