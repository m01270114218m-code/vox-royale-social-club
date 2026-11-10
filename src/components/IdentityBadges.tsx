import { levelBadge, vipBadge } from "@/lib/assets3d";
import { useAdminAsset } from "@/lib/media";
import { AdminAssetMedia } from "@/components/AdminAssetMedia";

export type ProfileBadge = { badge_key?: string; badge_name: string; badge_asset_key?: string | null; badge_color?: string | null; is_equipped?: boolean };

function BadgeChip({ badge }: { badge: ProfileBadge }) {
  const badgeAsset = useAdminAsset(badge.badge_asset_key ?? undefined);
  return <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold shadow-sm" style={{ borderColor: badge.badge_color || "#D4AF37", color: badge.badge_color || "#D4AF37" }} title={badge.badge_name}>
    {badgeAsset ? <AdminAssetMedia src={badgeAsset} alt={badge.badge_name} className="h-7 w-7 object-contain" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary">✦</span>}{badge.badge_name}
  </span>;
}

export function IdentityBadges({ level, vip = 0, badge, badges = [] }: { level?: number; vip?: number; badge?: ProfileBadge | null; badges?: ProfileBadge[] }) {
  const equipped = badges.length ? badges : badge ? [badge] : [];
  return <div className="flex flex-wrap items-center justify-center gap-1.5">
    {level !== undefined && <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-xs font-bold"><img src={levelBadge(level)} alt="" width={24} height={24} className="h-6 w-6 object-contain" loading="lazy" />Lv.{level}</span>}
    {vip > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"><img src={vipBadge(vip)} alt="" width={24} height={24} className="h-6 w-6 object-contain" loading="lazy" />VIP {vip}</span>}
    {equipped.map((item, index) => <BadgeChip key={item.badge_key || item.badge_name + index} badge={item} />)}
  </div>;
}
