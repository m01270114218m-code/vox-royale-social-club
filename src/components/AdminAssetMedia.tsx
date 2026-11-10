import { useEffect, useState } from "react";
import { isVideoAsset } from "@/lib/media";
type Props = { src?: string | null; alt?: string; className?: string; videoClassName?: string; loop?: boolean };
/** Renders private Supabase assets as the correct media type and makes video loading/type visible. */
export function AdminAssetMedia({ src, alt = "", className = "", videoClassName, loop = true }: Props) {
  const [failed, setFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  useEffect(() => { setFailed(false); setVideoReady(false); }, [src]);
  if (!src || failed) return <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={className} />;
  if (isVideoAsset(src)) return (
    <span className="admin-asset-media relative inline-flex overflow-hidden">
      <style>{`.admin-asset-video{pointer-events:none!important;-webkit-appearance:none;appearance:none}.admin-asset-video::-webkit-media-controls,.admin-asset-video::-webkit-media-controls-panel,.admin-asset-video::-webkit-media-controls-play-button,.admin-asset-video::-webkit-media-controls-start-playback-button,.admin-asset-video::-webkit-media-controls-timeline,.admin-asset-video::-webkit-media-controls-current-time-display,.admin-asset-video::-webkit-media-controls-time-remaining-display{display:none!important;-webkit-appearance:none!important;opacity:0!important}`}</style>
      <video src={src} autoPlay muted loop={loop} playsInline preload="auto" controls={false} disablePictureInPicture disableRemotePlayback controlsList="nodownload noplaybackrate noremoteplayback" aria-label={alt || "فيديو"} onLoadedData={() => setVideoReady(true)} onCanPlay={() => setVideoReady(true)} onError={() => setFailed(true)} className={`admin-asset-video ${videoClassName ?? className}`} />
      {!videoReady && <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/35 text-[10px] font-bold text-white">جارٍ تحميل الفيديو…</span>}
      <span className="pointer-events-none absolute bottom-1 left-1 z-20 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white">▶ MP4</span>
    </span>
  );
  return <img src={src} alt={alt} className={className} decoding="async" onError={() => setFailed(true)} />;
}
