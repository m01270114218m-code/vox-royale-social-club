import { useEffect, useState } from "react";
import { isVideoAsset } from "@/lib/media";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  videoClassName?: string;
  loop?: boolean;
};

/** Renders private Supabase assets as the correct media type and avoids broken-image icons. */
export function AdminAssetMedia({ src, alt = "", className = "", videoClassName, loop = true }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={`grid place-items-center rounded-lg bg-black/10 text-gold/70 ${className}`}
      >
        <span className="text-xl drop-shadow">✦</span>
      </span>
    );
  }
  if (isVideoAsset(src)) {
    return (
      <video
        src={src}
        autoPlay
        muted
        loop={loop}
        playsInline
        preload="metadata"
        aria-label={alt || undefined}
        onError={() => setFailed(true)}
        className={videoClassName ?? className}
      />
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
