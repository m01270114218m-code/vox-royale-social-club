import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    if (!url || !serviceKey) return reply({ error: "خدمة تسجيل الجهاز غير مهيأة" }, 500);

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const deviceId = String(body?.deviceId ?? "").trim();
    if (deviceId.length < 16 || deviceId.length > 128) return reply({ error: "Invalid device identity" }, 400);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Unauthorized" }, 401);

    const salt = Deno.env.get("REGISTRATION_HASH_SALT") ?? url;
    const deviceHash = await sha256(salt + ":device:" + deviceId);
    const rawIp = req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-real-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "";
    const ipHash = rawIp ? await sha256(salt + ":ip:" + rawIp) : null;

    const { error } = await admin.from("account_device_registry").upsert({
      user_id: authData.user.id,
      device_hash: deviceHash,
      ip_hash: ipHash,
    }, { onConflict: "device_hash,user_id" });
    if (error) throw error;
    return reply({ status: "registered" });
  } catch (error) {
    console.error("[register-device]", error);
    return reply({ error: error instanceof Error ? error.message : "تعذر تسجيل الجهاز" }, 500);
  }
});
