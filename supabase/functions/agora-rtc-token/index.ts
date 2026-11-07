import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function numericUid(userId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 1) || 1;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const appId = Deno.env.get("AGORA_APP_ID");
  const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!appId || !appCertificate || !supabaseUrl || !anonKey) {
    return json({ error: "Agora token service is not configured" }, 503);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return json({ error: "Invalid session" }, 401);

  let body: { roomId?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)) {
    return json({ error: "A valid roomId is required" }, 400);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("room_members").select("user_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership) return json({ error: "You are not a member of this room" }, 403);

  const { data: seat, error: seatError } = await supabase
    .from("room_seats").select("user_id,is_muted").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
  if (seatError) return json({ error: "Unable to verify microphone permissions" }, 500);

  const canPublish = !!seat && seat.is_muted !== true;
  const channelName = roomId.replaceAll("-", "");
  const rtcUid = numericUid(user.id);
  const expiresInSeconds = 60 * 60;
  const role = canPublish ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId, appCertificate, roomId, rtcUid, role, expiresInSeconds, expiresInSeconds,
    );
    return json({ appId, channel: channelName, uid: rtcUid, token, role: canPublish ? "publisher" : "subscriber", expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds });
  } catch {
    return json({ error: "Failed to create Agora token" }, 500);
  }
});
