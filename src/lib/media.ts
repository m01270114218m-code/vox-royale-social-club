import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Upload an image to the current user's folder; returns a storage path ("media:<path>"). */
export async function uploadImage(file: File, userId: string): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error("يسمح فقط بالصور (JPG, PNG, WEBP, GIF)");
  if (file.size > 5 * 1024 * 1024) throw new Error("الحد الأقصى لحجم الصورة 5MB");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return `media:${path}`;
}

/** Resolve a stored value (http URL or "media:<path>") into a displayable URL. */
export function useMedia(value?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!value) return null;
    if (!value.startsWith("media:")) return value;
    return cache.get(value) ?? null;
  });
  useEffect(() => {
    if (!value) return setUrl(null);
    if (!value.startsWith("media:")) return setUrl(value);
    const hit = cache.get(value);
    if (hit) return setUrl(hit);
    let alive = true;
    supabase.storage
      .from("media")
      .createSignedUrl(value.slice(6), 60 * 60 * 6)
      .then(({ data }) => {
        if (data?.signedUrl && alive) {
          cache.set(value, data.signedUrl);
          setUrl(data.signedUrl);
        }
      });
    return () => {
      alive = false;
    };
  }, [value]);
  return url;
}

const adminAssetCache = new Map<string, string>();

/** Resolve an active asset from the administrator-managed private bucket. */
export async function getAdminAssetUrl(assetKey?: string | null): Promise<string | null> {
  if (!assetKey) return null;
  const cached = adminAssetCache.get(assetKey);
  if (cached) return cached;
  const { data: asset, error } = await supabase
    .from("admin_assets")
    .select("url,metadata")
    .eq("asset_key", assetKey)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !asset) return null;
  const metadata = asset.metadata as { storage_path?: string } | null;
  const raw = metadata?.storage_path || asset.url;
  if (!raw) return null;
  // Accept both a storage path and a full Supabase Storage URL; only pass the path to createSignedUrl.
  const marker = "/storage/v1/object/";
  let path = raw;
  const markerIndex = raw.indexOf(marker);
  if (markerIndex >= 0) {
    const tail = raw.slice(markerIndex + marker.length).split("?")[0];
    const publicPrefix = "public/admin-assets/";
    const signPrefix = "sign/admin-assets/";
    path = tail.startsWith(publicPrefix) ? tail.slice(publicPrefix.length) : tail.startsWith(signPrefix) ? tail.slice(signPrefix.length) : tail;
  }
  path = decodeURIComponent(path.replace(/^\/+/, ""));
  if (path.startsWith("admin-assets/")) path = path.slice("admin-assets/".length);
  const { data: signed, error: signError } = await supabase.storage
    .from("admin-assets")
    .createSignedUrl(path, 60 * 60);
  if (signError || !signed?.signedUrl) return null;
  adminAssetCache.set(assetKey, signed.signedUrl);
  return signed.signedUrl;
}

export function useAdminAsset(assetKey?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (assetKey ? adminAssetCache.get(assetKey) ?? null : null));
  useEffect(() => {
    let alive = true;
    if (!assetKey) {
      setUrl(null);
      return;
    }
    const hit = adminAssetCache.get(assetKey);
    if (hit) {
      setUrl(hit);
      return;
    }
    setUrl(null);
    void getAdminAssetUrl(assetKey).then((next) => {
      if (alive) setUrl(next);
    });
    return () => { alive = false; };
  }, [assetKey]);
  return url;
}
