import { useMedia } from "@/lib/media";

export function UserAvatar({ src, name, size = 48, ring = false }: { src?: string | null | undefined; name?: string | null | undefined; size?: number; ring?: boolean }) {
  const url = useMedia(src);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold font-bold ${ring ? "shadow-gold ring-2 ring-primary" : ""}`}
      style={{ width: size, height: size, fontSize: size / 2.4 }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span>{(name ?? "?").slice(0, 1)}</span>}
    </div>
  );
}

export function MediaImage({ src, className }: { src: string; className?: string }) {
  const url = useMedia(src);
  if (!url) return <div className={`animate-pulse bg-muted ${className ?? ""}`} />;
  return <img src={url} alt="" className={className} loading="lazy" />;
}
