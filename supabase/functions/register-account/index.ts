import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    if (!url || !serviceKey) return json({ error: "خدمة التسجيل غير مهيأة على الخادم" }, 500);

    const body = await req.json();
    const displayName = String(body?.displayName ?? "").trim().slice(0, 48);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const deviceId = String(body?.deviceId ?? "").trim();

    if (displayName.length < 2) return json({ error: "اكتب اسمًا صحيحًا لا يقل عن حرفين" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "البريد الإلكتروني غير صحيح" }, 400);
    if (password.length < 8) return json({ error: "كلمة المرور يجب ألا تقل عن 8 أحرف" }, 400);
    if (deviceId.length < 16 || deviceId.length > 128) return json({ error: "تعذر التحقق من الجهاز. أغلق التطبيق وافتحه مرة أخرى." }, 400);

    const salt = Deno.env.get("REGISTRATION_HASH_SALT") ?? url;
    const deviceHash = await sha256(salt + ":device:" + deviceId);
    const rawIp = req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-real-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "";
    const ipHash = rawIp ? await sha256(salt + ":ip:" + rawIp) : null;

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: previousRequest, error: requestLookupError } = await admin
      .from("account_registration_requests")
      .select("id,status")
      .eq("email", email)
      .eq("device_hash", deviceHash)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (requestLookupError) throw requestLookupError;

    if (previousRequest?.status === "pending") {
      return json({ status: "pending", message: "طلب إنشاء الحساب قيد مراجعة الإدارة." });
    }

    let needsReview = false;
    if (previousRequest?.status !== "approved") {
      const { data: byDevice, error: deviceError } = await admin
        .from("account_device_registry")
        .select("id")
        .eq("device_hash", deviceHash)
        .limit(1)
        .maybeSingle();
      if (deviceError) throw deviceError;
      needsReview = !!byDevice;

      if (!needsReview && ipHash) {
        const { data: byNetwork, error: networkError } = await admin
          .from("account_device_registry")
          .select("id")
          .eq("ip_hash", ipHash)
          .limit(1)
          .maybeSingle();
        if (networkError) throw networkError;
        needsReview = !!byNetwork;
      }
    }

    if (needsReview) {
      const { error } = await admin.from("account_registration_requests").insert({
        display_name: displayName,
        email,
        device_hash: deviceHash,
        ip_hash: ipHash,
        status: "pending",
      });
      if (error) throw error;
      return json({ status: "pending", message: "تم إرسال طلبك إلى الإدارة للمراجعة." });
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: displayName, display_name: displayName },
    });
    if (createError) {
      if (/already|registered|exists/i.test(createError.message)) {
        return json({ error: "هذا البريد مسجل بالفعل. استخدم تسجيل الدخول للحساب الموجود." }, 409);
      }
      throw createError;
    }
    if (!created.user) throw new Error("لم يتم إنشاء الحساب");

    const { error: registryError } = await admin.from("account_device_registry").insert({
      user_id: created.user.id,
      device_hash: deviceHash,
      ip_hash: ipHash,
    });
    if (registryError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw registryError;
    }

    if (previousRequest?.status === "approved") {
      await admin.from("account_registration_requests")
        .update({ status: "fulfilled" })
        .eq("id", previousRequest.id);
    }

    return json({ status: "created", message: "تم إنشاء الحساب بنجاح." }, 201);
  } catch (error) {
    console.error("[register-account]", error);
    return json({ error: error instanceof Error ? error.message : "تعذر إنشاء الحساب الآن" }, 500);
  }
});
