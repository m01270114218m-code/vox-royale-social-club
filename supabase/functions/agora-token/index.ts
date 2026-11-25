import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import { RtcRole, RtcTokenBuilder } from "npm:agora-token@2.0.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const appId = Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");
    if (!supabaseUrl || !anonKey) throw new Error("إعداد Supabase غير مكتمل");
    if (!appId || !appCertificate) throw new Error("خدمة الصوت غير مهيأة: أضف AGORA_APP_ID وAGORA_APP_CERTIFICATE إلى أسرار Supabase");

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return Response.json({ error: "جلسة الدخول غير صالحة" }, { status: 401, headers: cors });

    const body = await req.json();
    const roomId = Number(body?.room_id);
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      return Response.json({ error: "رقم الغرفة غير صحيح" }, { status: 400, headers: cors });
    }

    const [{ data: profile, error: profileError }, { data: room, error: roomError }] = await Promise.all([
      supabase.from("profiles").select("uid,banned").eq("id", authData.user.id).single(),
      supabase.from("rooms").select("room_uid").eq("room_uid", roomId).maybeSingle(),
    ]);
    if (profileError || !profile) throw new Error("لم يتم العثور على ملف المستخدم");
    if (profile.banned) return Response.json({ error: "الحساب محظور" }, { status: 403, headers: cors });
    if (roomError || !room) return Response.json({ error: "الغرفة غير موجودة" }, { status: 404, headers: cors });

    // Only an account with an active database membership may obtain an Agora token.
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", room.id)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (membershipError) throw new Error("تعذّر التحقق من عضوية الغرفة");
    if (!membership) return Response.json({ error: "يجب دخول الغرفة أولاً" }, { status: 403, headers: cors });

    const uid = Number(body?.rtc_uid ?? profile.uid);
    if (!Number.isSafeInteger(uid) || uid <= 0 || uid > 4294967295) throw new Error("معرّف اتصال الصوت غير صالح");
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

    return Response.json({ appId, channel, uid, token, expireAt }, { headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذّر إصدار رمز الصوت";
    return Response.json({ error: message }, { status: 400, headers: { ...cors, "Cache-Control": "no-store" } });
  }
});
