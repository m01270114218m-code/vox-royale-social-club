import { isVideoAsset, useAdminAsset, useMedia } from "@/lib/media";
import { icons3d } from "@/lib/assets3d";

export function UserAvatar({ src, name, size = 48, ring = false, vip = 0, frameKey }: { src?: string | null | undefined; name?: string | null | undefined; size?: number; ring?: boolean; vip?: number | undefined; frameKey?: string | null | undefined }) {
  const url = useMedia(src);
  const dynamicFrame = useAdminAsset(frameKey);
  // User-equipped frames must resolve from the Supabase asset registry only.
  const frame = frameKey ? dynamicFrame : null;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className={`absolute flex items-center justify-center overflow-hidden rounded-full bg-secondary ${frame ? "inset-[18%]" : "inset-0"} ${ring && !frame ? "shadow-gold ring-2 ring-primary" : ""}`}>
        <img src={url ?? icons3d.profile} alt={name ?? "صورة المستخدم"} className={`h-full w-full ${url ? "object-cover" : "object-contain p-1"}`} />
      </div>
      {frame && (isVideoAsset(frame) ? <video src={frame} autoPlay muted loop playsInline aria-label={vip ? `إطار المستخدم VIP ${vip}` : "إطار المستخدم"} className="pointer-events-none absolute inset-0 h-full w-full object-contain" /> : <img src={frame} alt={vip ? `إطار المستخدم VIP ${vip}` : "إطار المستخدم"} width={size} height={size} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />)}
    </div>
  );
}

export function MediaImage({ src, className }: { src: string; className?: string }) {
  const url = useMedia(src);
  if (!url) return <div className={`animate-pulse bg-muted ${className ?? ""}`} />;
  return isVideoAsset(url)
    ? <span className={`relative block overflow-hidden ${className ?? ""}`}><video src={url} autoPlay muted loop playsInline preload="auto" aria-hidden="true" className="h-full w-full object-cover" /><span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/75 px-1 py-0.5 text-[8px] font-black text-white">▶ MP4</span></span>
    : <img src={url} alt="" className={className} loading="lazy" />;
}
