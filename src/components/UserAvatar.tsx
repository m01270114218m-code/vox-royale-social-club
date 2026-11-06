import { useMedia } from "@/lib/media";
import { avatarFrame, frameByKey, icons3d } from "@/lib/assets3d";

export function UserAvatar({ src, name, size = 48, ring = false, vip = 0, frameKey }: { src?: string | null | undefined; name?: string | null | undefined; size?: number; ring?: boolean; vip?: number | undefined; frameKey?: string | null | undefined }) {
  const url = useMedia(src);
  const frame = frameByKey(frameKey) ?? avatarFrame(vip);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className={`absolute flex items-center justify-center overflow-hidden rounded-full bg-secondary ${frame ? "inset-[18%]" : "inset-0"} ${ring && !frame ? "shadow-gold ring-2 ring-primary" : ""}`}>
        <img src={url ?? icons3d.profile} alt={name ?? "صورة المستخدم"} className={`h-full w-full ${url ? "object-cover" : "object-contain p-1"}`} />
      </div>
      {frame && <img src={frame} alt={`إطار VIP ${vip}`} width={size} height={size} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
    </div>
  );
}

export function MediaImage({ src, className }: { src: string; className?: string }) {
  const url = useMedia(src);
  if (!url) return <div className={`animate-pulse bg-muted ${className ?? ""}`} />;
  return <img src={url} alt="" className={className} loading="lazy" />;
}
