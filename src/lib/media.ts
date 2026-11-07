import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

async function compressImage(file: File): Promise<File> {
  if (!ALLOWED.includes(file.type)) throw new Error("يسمح فقط بالصور (JPG, PNG, WEBP, GIF)");
  if (file.size <= 900 * 1024 && file.type === "image/webp") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    if (file.size > MAX_BYTES) throw new Error("تعذر ضغط الصورة؛ اختر صورة أصغر من 5MB");
    return file;
  }
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز الصورة");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("تعذر ضغط الصورة");
  return new File([blob], "upload.webp", { type: "image/webp", lastModified: Date.now() });
}

/** Upload a user-owned image to Supabase Storage and return a media:<path> reference. */
export async function uploadImage(file: File, userId: string, folder = "profile"): Promise<string> {
  const compressed = await compressImage(file);
  const path = folder === "profile"
    ? `${userId}/${crypto.randomUUID()}.webp`
    : `${userId}/${folder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("media").upload(path, compressed, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  return `media:${path}`;
}

export async function deleteMedia(value?: string | null): Promise<void> {
  if (!value?.startsWith("media:")) return;
  const path = value.slice(6).replace(/^\/+/, "");
  const { error } = await supabase.storage.from("media").remove([path]);
  if (error) throw error;
  cache.delete(value);
}

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
    supabase.storage.from("media").createSignedUrl(value.slice(6), 60 * 60 * 6).then(({ data }) => {
      if (data?.signedUrl && alive) {
        cache.set(value, data.signedUrl);
        setUrl(data.signedUrl);
      }
    });
    return () => { alive = false; };
  }, [value]);
  return url;
}

const adminAssetCache = new Map<string, string>();

export async function getAdminAssetUrl(assetKey?: string | null): Promise<string | null> {
  if (!assetKey) return null;
  const cached = adminAssetCache.get(assetKey);
  if (cached) return cached;
  const { data: asset, error } = await supabase.from("admin_assets").select("url,metadata").eq("asset_key", assetKey).eq("is_active", true).maybeSingle();
  if (error || !asset) return null;
  const metadata = asset.metadata as { storage_path?: string } | null;
  const raw = metadata?.storage_path || asset.url;
  if (!raw) return null;
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
  const { data: signed, error: signError } = await supabase.storage.from("admin-assets").createSignedUrl(path, 60 * 60);
  if (signError || !signed?.signedUrl) return null;
  adminAssetCache.set(assetKey, signed.signedUrl);
  return signed.signedUrl;
}

export function useAdminAsset(assetKey?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (assetKey ? adminAssetCache.get(assetKey) ?? null : null));
  useEffect(() => {
    let alive = true;
    if (!assetKey) { setUrl(null); return; }
    const hit = adminAssetCache.get(assetKey);
    if (hit) { setUrl(hit); return; }
    setUrl(null);
    void getAdminAssetUrl(assetKey).then((next) => { if (alive) setUrl(next); });
    return () => { alive = false; };
  }, [assetKey]);
  return url;
}
