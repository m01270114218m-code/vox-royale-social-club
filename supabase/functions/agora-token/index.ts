import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import { RtcRole, RtcTokenBuilder } from "npm:agora-token@2.0.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
}

function getSecretKey() {
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // Fall through to the legacy server-only key.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "سجّل الدخول أولاً" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")
      || (() => {
        const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
        if (!raw) return "";
        try { return (JSON.parse(raw) as Record<string, string>).default || ""; } catch { return ""; }
      })();
    const secretKey = getSecretKey();
    const appId = Deno.env.get("AGORA_APP_ID")?.trim();
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE")?.trim();

    if (!supabaseUrl || !publishableKey) throw new Error("إعداد Supabase غير مكتمل");
    if (!appId || !appCertificate) {
      return json({ error: "خدمة الصوت غير مهيأة: بيانات Agora غير موجودة في أسرار Supabase" }, 503);
    }

    // Validate the caller's Supabase session with the user's JWT.
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "جلسة الدخول غير صالحة" }, 401);

    const body = await req.json().catch(() => ({}));
    const roomId = Number(body?.room_id);
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      return json({ error: "رقم الغرفة غير صحيح" }, 400);
    }

    // Room/membership checks use the server-only key so RLS cannot turn a valid
    // active membership into a false negative inside this token endpoint.
    const db = secretKey
      ? createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : userClient;

    const [{ data: profile, error: profileError }, { data: room, error: roomError }] = await Promise.all([
      db.from("profiles").select("uid,banned").eq("id", authData.user.id).maybeSingle(),
      db.from("rooms").select("id,room_uid").eq("room_uid", roomId).maybeSingle(),
    ]);

    if (profileError) throw new Error("تعذّر قراءة ملف المستخدم");
    if (!profile) return json({ error: "لم يتم العثور على ملف المستخدم" }, 404);
    if (profile.banned) return json({ error: "الحساب محظور" }, 403);
    if (roomError) throw new Error("تعذّر قراءة الغرفة");
    if (!room) return json({ error: "الغرفة غير موجودة" }, 404);

    const { data: membership, error: membershipError } = await db
      .from("room_members")
      .select("user_id")
      .eq("room_id", room.id)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (membershipError) throw new Error("تعذّر التحقق من عضوية الغرفة");
    if (!membership) return json({ error: "يجب دخول الغرفة أولاً" }, 403);

    const requestedUid = Number(body?.rtc_uid);
    const profileUid = Number(profile.uid);
    const uid = Number.isSafeInteger(requestedUid) && requestedUid > 0 && requestedUid <= 2147483647
      ? requestedUid
      : profileUid;
    if (!Number.isSafeInteger(uid) || uid <= 0 || uid > 2147483647) {
      throw new Error("معرّف اتصال الصوت غير صالح");
    }

    const channel = `sada-room-${room.room_uid}`;
    const expireAt = Math.floor(Date.now() / 1000) + 3600;
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channel,
      uid,
      RtcRole.PUBLISHER,
      expireAt,
      expireAt,
    );

    if (!token) throw new Error("تعذّر إنشاء رمز Agora");
    return json({ appId, channel, uid, token, expireAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذّر إصدار رمز الصوت";
    console.error("[agora-token]", message);
    return json({ error: message }, 500);
  }
});
