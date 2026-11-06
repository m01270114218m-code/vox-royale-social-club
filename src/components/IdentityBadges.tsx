import { levelBadge, vipBadge } from "@/lib/assets3d";

export function IdentityBadges({ level, vip = 0 }: { level?: number | undefined; vip?: number | undefined }) {
  return <div className="flex flex-wrap items-center justify-center gap-2">
    {level !== undefined && <span className="inline-flex items-center gap-1 text-xs font-bold"><img src={levelBadge(level)} alt="" width={30} height={30} className="h-7 w-7 object-contain" loading="lazy" />Lv.{level}</span>}
    {vip > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold text-primary"><img src={vipBadge(vip)} alt="" width={30} height={30} className="h-7 w-7 object-contain" loading="lazy" />VIP {vip}</span>}
  </div>;
}