import { useEffect, useRef, useState } from "react";
import { isVideoAsset } from "@/lib/media";

type Props = { src?: string | null; alt?: string; className?: string; videoClassName?: string; loop?: boolean };

/** Displays MP4 assets as animated artwork without video labels or loading overlays. */
export function AdminAssetMedia({ src, alt = "", className = "", videoClassName, loop = true }: Props) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    setFailed(false);
    const unlockAudio = () => { void videoRef.current?.play().catch(() => {}); };
    window.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
    return () => window.removeEventListener("pointerdown", unlockAudio, true);
  }, [src]);

  if (!src || failed) return <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={className} />;

  if (isVideoAsset(src)) return (
    <span className={`admin-asset-media relative inline-flex overflow-hidden ${className}`} onPointerDown={() => { void videoRef.current?.play().catch(() => {}); }}>
      <style>{`.admin-asset-video{pointer-events:none!important;-webkit-appearance:none;appearance:none;object-fit:inherit}.admin-asset-video::-webkit-media-controls,.admin-asset-video::-webkit-media-controls-panel,.admin-asset-video::-webkit-media-controls-play-button,.admin-asset-video::-webkit-media-controls-start-playback-button,.admin-asset-video::-webkit-media-controls-timeline,.admin-asset-video::-webkit-media-controls-current-time-display,.admin-asset-video::-webkit-media-controls-time-remaining-display{display:none!important;-webkit-appearance:none!important;opacity:0!important}`}</style>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted={false}
        loop={loop}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate noremoteplayback"
        aria-label={alt || undefined}
        onLoadedMetadata={(e) => { void e.currentTarget.play().catch(() => {}); }}
        onCanPlay={(e) => { void e.currentTarget.play().catch(() => {}); }}
        onError={() => setFailed(true)}
        className={`admin-asset-video block ${videoClassName ?? className}`}
      />
    </span>
  );

  return <img src={src} alt={alt} className={className} decoding="async" onError={() => setFailed(true)} />;
}
