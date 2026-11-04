import rose from "@/assets/3d/rose.png";
import heart from "@/assets/3d/heart.png";
import crown from "@/assets/3d/crown.png";
import diamond from "@/assets/3d/diamond.png";
import car from "@/assets/3d/car.png";
import castle from "@/assets/3d/castle.png";
import dragon from "@/assets/3d/dragon.png";
import giftbox from "@/assets/3d/giftbox.png";
import home from "@/assets/3d/home.png";
import explore from "@/assets/3d/explore.png";
import friends from "@/assets/3d/friends.png";
import messages from "@/assets/3d/messages.png";
import profile from "@/assets/3d/profile.png";
import store from "@/assets/3d/store.png";
import wallet from "@/assets/3d/wallet.png";
import vip from "@/assets/3d/vip.png";
import coin from "@/assets/3d/coin.png";
import chest from "@/assets/3d/chest.png";

export const icons3d = { home, explore, friends, messages, profile, store, wallet, vip, coin, chest, giftbox };

const byName: Record<string, string> = {
  "وردة": rose, "قلب": heart, "تاج": crown, "خاتم": diamond, "سيارة": car, "قلعة": castle, "صاروخ": dragon,
};
const byEmoji: Record<string, string> = { "🌹": rose, "💖": heart, "👑": crown, "💍": diamond, "🏎️": car, "🏰": castle, "🚀": dragon };

export function giftImage(name?: string, emoji?: string) {
  return (name && byName[name]) || (emoji && byEmoji[emoji]) || giftbox;
}
