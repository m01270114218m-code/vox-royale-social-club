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
