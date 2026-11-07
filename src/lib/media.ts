import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

type CachedUrl = { url: string; expiresAt: number };
const cache = new Map<string, CachedUrl>();
const adminAssetCache = new Map<string, CachedUrl>();

const cacheGet = (map: Map<string, CachedUrl>, key: string) => {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    map.delete(key);
    return null;
  }
  return hit.url;
};

const cacheSet = (map: Map<string, CachedUrl>, key: string, url: string, ttlMs: number) => {
  map.set(key, { url, expiresAt: Date.now() + ttlMs });
};

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
  const { error } = await supabase.storage.from("media").upload(path, compressed, {
    contentType: "image/webp",
    upsert: false,
  });
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
    return cacheGet(cache, value);
  });

  useEffect(() => {
    if (!value) {
      setUrl(null);
      return;
    }
    if (!value.startsWith("media:")) {
      setUrl(value);
      return;
    }

    const hit = cacheGet(cache, value);
    if (hit) {
      setUrl(hit);
      return;
    }

    let alive = true;
    const path = value.slice(6).replace(/^\/+/, "");
    void supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 6).then(({ data }) => {
      if (!alive) return;
      if (data?.signedUrl) {
        cacheSet(cache, value, data.signedUrl, 5 * 60 * 60 * 1000);
        setUrl(data.signedUrl);
      } else {
        setUrl(null);
      }
    });

    return () => { alive = false; };
  }, [value]);

  return url;
}

export async function getAdminAssetUrl(assetKey?: string | null): Promise<string | null> {
  if (!assetKey) return null;
  const cached = cacheGet(adminAssetCache, assetKey);
  if (cached) return cached;

  let raw = assetKey.trim();

  // A media:<path> value is a valid reference to the public media bucket.
  if (raw.startsWith("media:")) {
    const path = raw.slice(6).replace(/^\/+/, "");
    if (!path) return null;
    const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 6);
    if (error || !data?.signedUrl) return null;
    cacheSet(adminAssetCache, assetKey, data.signedUrl, 5 * 60 * 60 * 1000);
    return data.signedUrl;
  }

  // If this is an asset key, resolve it from the admin asset registry.
  if (!/^https?:\/\//i.test(raw)) {
    const { data: asset, error } = await supabase
      .from("admin_assets")
      .select("url,metadata")
      .eq("asset_key", assetKey)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !asset) return null;

    const metadata = asset.metadata as { storage_path?: string } | null;
    raw = metadata?.storage_path || asset.url || "";
    if (!raw) return null;
  }

  const marker = "/storage/v1/object/";
  const markerIndex = raw.indexOf(marker);

  // Plain HTTPS image/CDN URLs are already usable.
  if (markerIndex < 0) {
    if (/^https?:\/\//i.test(raw)) {
      cacheSet(adminAssetCache, assetKey, raw, 24 * 60 * 60 * 1000);
      return raw;
    }
    return null;
  }

  const tail = raw.slice(markerIndex + marker.length).split("?")[0];
  const parts = tail.split("/");
  const access = parts.shift();
  const bucket = parts.shift();
  const storagePath = decodeURIComponent(parts.join("/").replace(/^\/+/, ""));
  if (!access || !bucket || !storagePath) return null;

  // Public objects, such as media/<path>, must be used directly.
  if (access === "public") {
    cacheSet(adminAssetCache, assetKey, raw, 24 * 60 * 60 * 1000);
    return raw;
  }

  // Private/signed objects: recreate a fresh signed URL from the actual bucket.
  if (access === "sign" || access === "authenticated") {
    const { data: signed, error: signError } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60);

    if (signError || !signed?.signedUrl) return null;
    cacheSet(adminAssetCache, assetKey, signed.signedUrl, 50 * 60 * 1000);
    return signed.signedUrl;
  }

  return null;
}

export function useAdminAsset(assetKey?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (
    assetKey ? cacheGet(adminAssetCache, assetKey) : null
  ));

  useEffect(() => {
    let alive = true;

    if (!assetKey) {
      setUrl(null);
      return;
    }

    const hit = cacheGet(adminAssetCache, assetKey);
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
