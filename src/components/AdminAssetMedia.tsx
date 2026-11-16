import { useEffect, useRef, useState } from "react";
import { isVideoAsset } from "@/lib/media";

type Props = { src?: string | null; alt?: string; className?: string; videoClassName?: string; loop?: boolean; muted?: boolean };

/** Displays MP4 assets as animated artwork without video labels or loading overlays. */
export function AdminAssetMedia({ src, alt = "", className = "", videoClassName, loop = true, muted = false }: Props) {
  const [failed, setFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const revealTimer = useRef<number | null>(null);
  useEffect(() => {
    setFailed(false);
    setVideoReady(false);
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    const unlockAudio = () => { void videoRef.current?.play().catch(() => {}); };
    window.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true);
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
      revealTimer.current = null;
    };
  }, [src]);

  if (!src || failed) return <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={className} />;

  if (isVideoAsset(src)) return (
    <span className={`admin-asset-media relative inline-flex overflow-hidden ${className}`} onPointerDown={() => { void videoRef.current?.play().catch(() => {}); }}>
      <style>{`.admin-asset-video{pointer-events:none!important;-webkit-appearance:none;appearance:none;object-fit:inherit}.admin-asset-video::-webkit-media-controls,.admin-asset-video::-webkit-media-controls-panel,.admin-asset-video::-webkit-media-controls-play-button,.admin-asset-video::-webkit-media-controls-start-playback-button,.admin-asset-video::-webkit-media-controls-timeline,.admin-asset-video::-webkit-media-controls-current-time-display,.admin-asset-video::-webkit-media-controls-time-remaining-display{display:none!important;-webkit-appearance:none!important;opacity:0!important}`}</style>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted={muted}
        loop={loop}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate noremoteplayback"
        aria-label={alt || undefined}
        onLoadedMetadata={(e) => { void e.currentTarget.play().catch(() => {}); }}
        onCanPlay={(e) => {
          void e.currentTarget.play().catch(() => {});
          if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
          // Wait briefly after the browser has enough buffered data before revealing the MP4.
          revealTimer.current = window.setTimeout(() => setVideoReady(true), 220);
        }}
        onError={() => setFailed(true)}
        style={{ opacity: videoReady ? 1 : 0, transition: "opacity 180ms ease-out" }}
        className={`admin-asset-video block ${videoClassName ?? className}`}
      />
    </span>
  );

  return <img src={src} alt={alt} className={className} decoding="async" onError={() => setFailed(true)} />;
}
