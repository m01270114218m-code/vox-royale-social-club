import { isVideoAsset } from "@/lib/media";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  videoClassName?: string;
  loop?: boolean;
};

/** Renders an admin-managed Supabase asset according to its actual media type.
 * MP4 assets must be played by a video element (never by img/background-image).
 */
export function AdminAssetMedia({ src, alt = "", className = "", videoClassName, loop = true }: Props) {
  if (!src) return null;
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
        className={videoClassName ?? className}
      />
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
