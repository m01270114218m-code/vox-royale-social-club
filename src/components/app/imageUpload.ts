/** Resize an uploaded image file to a compact data URL suitable for localStorage. */
export function readImageFile(file: File, maxDim = 512, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("not-image"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      const img = new Image();
      img.onerror = () => reject(new Error("decode-failed"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(src); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** Upload a resized image to the user's public media folder in Supabase Storage. */
export async function uploadImageDataUrl(dataUrl: string, folder: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("سجل الدخول أولاً لرفع الصورة");
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("تعذّر تجهيز الصورة للرفع");
  const blob = await response.blob();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "-");
  const path = `${auth.user.id}/${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("imchat-avatars").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("imchat-avatars").getPublicUrl(path).data.publicUrl;
}
