import { levelBadge, vipBadge } from "@/lib/assets3d";
import { useAdminAsset } from "@/lib/media";
import { AdminAssetMedia } from "@/components/AdminAssetMedia";

export type ProfileBadge = { badge_key?: string; badge_name: string; badge_asset_key?: string | null; badge_color?: string | null; is_equipped?: boolean };

function BadgeChip({ badge }: { badge: ProfileBadge }) {
  const badgeAsset = useAdminAsset(badge.badge_asset_key ?? undefined);
  return badgeAsset
    ? <AdminAssetMedia src={badgeAsset} alt={badge.badge_name} title={badge.badge_name} className="h-10 w-10 shrink-0 object-contain drop-shadow-md" />
    : <span className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl font-black" style={{ color: badge.badge_color || "#D4AF37" }} title={badge.badge_name}>✦</span>;
}

export function IdentityBadges({ level, vip = 0, badge, badges = [] }: { level?: number; vip?: number; badge?: ProfileBadge | null; badges?: ProfileBadge[] }) {
  const equipped = badges.length ? badges : badge ? [badge] : [];
  return <div className="flex w-full flex-col items-center justify-center gap-2">
    {(level !== undefined || vip > 0) && <div className="flex flex-wrap items-center justify-center gap-2">
      {level !== undefined && <span className="inline-flex items-center gap-1 text-xs font-bold"><img src={levelBadge(level)} alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" loading="lazy" /><span>Lv.{level}</span></span>}
      {vip > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold text-primary"><img src={vipBadge(vip)} alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" loading="lazy" /><span>VIP {vip}</span></span>}
    </div>}
    {equipped.length > 0 && <div className="flex flex-wrap items-center justify-center gap-2">{equipped.map((item, index) => <BadgeChip key={item.badge_key || item.badge_name + index} badge={item} />)}</div>}
  </div>;
}
