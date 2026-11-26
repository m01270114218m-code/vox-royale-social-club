import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/app/session";
import { toast } from "@/components/app/toast";
import { loginMedia, ui } from "@/components/app/data";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول | صدى شات" }, { name: "description", content: "سجّل دخولك إلى صدى شات وانضم لغرف الدردشة الصوتية" }, { property: "og:title", content: "تسجيل الدخول | صدى شات" }, { property: "og:description", content: "سجّل دخولك إلى صدى شات وانضم لغرف الدردشة الصوتية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Login,
});

function deviceIdentity() {
  const key = "sada-chat-device-v1";
  let value = localStorage.getItem(key);
  if (!value) {
    value = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sada-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

function Login() {
  const nav = useNavigate();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { if (auth?.userId) void nav({ to: "/", replace: true }); }, [auth, nav]);

  const run = async () => {
    setBusy(true);
    setNotice("");
    try {
      const normalized = email.trim().toLowerCase();
      if (!normalized) throw new Error("أدخل البريد الإلكتروني");
      if (password.length < 8) throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف");

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
        if (error) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        return;
      }

      if (name.trim().length < 2) throw new Error("اكتب اسمك كما سيظهر داخل التطبيق");
      const { data, error } = await supabase.functions.invoke("register-account", {
        body: { displayName: name.trim(), email: normalized, password, deviceId: deviceIdentity() },
      });
      if (error) {
        const context = (error as Error & { context?: { json?: () => Promise<{ error?: string }> } }).context;
        const detail = await context?.json?.().catch(() => undefined);
        throw new Error(detail?.error || "تعذّر إرسال طلب التسجيل. حاول مرة أخرى.");
      }
      if (data?.status === "pending") {
        setNotice("تم إرسال طلب إنشاء الحساب إلى الإدارة. ستتمكن من الدخول بعد الموافقة.");
        setPassword("");
        return;
      }
      if (data?.status !== "created") throw new Error(data?.error || "تعذّر إنشاء الحساب");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (signInError) throw new Error("تم إنشاء الحساب، لكن تعذّر تسجيل الدخول تلقائيًا. سجّل الدخول بكلمة المرور.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      console.error("[Login] authentication failed", error);
      toast(message || "تعذّر إكمال العملية، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  const field = "h-12 w-full rounded-xl border border-border bg-secondary/90 px-4 text-[14px] text-navy";
  const activeTab = "h-10 flex-1 rounded-xl bg-gold text-night font-black text-[12px] shadow";
  const idleTab = "h-10 flex-1 rounded-xl bg-white/10 text-night-foreground/80 font-bold text-[12px]";
  return <div dir="rtl" className="relative mx-auto h-[100dvh] max-w-[440px] overflow-hidden bg-night text-night-foreground">
    <video className="absolute inset-0 h-full w-full object-cover" src={loginMedia.video} poster={loginMedia.poster} autoPlay muted loop playsInline />
    <div className="login-scrim absolute inset-0" />
    <div className="relative flex h-full flex-col items-center px-5 pb-5 pt-12">
      <div className="auth-option relative grid h-[92px] w-[92px] place-items-center rounded-full login-glass gold-ring"><img src={ui.castle} alt="" className="h-16 w-16 object-contain" /></div>
      <h1 className="wordmark auth-option mt-4 text-[44px] leading-none" dir="ltr" lang="en">SadaChat</h1>
      <p className="auth-option mt-2 flex items-center gap-2 text-[13px] font-bold tracking-wide opacity-90"><span className="h-px w-7 bg-gold/60" />صدى شات<span className="h-px w-7 bg-gold/60" /></p>
      <p className="auth-option mt-1.5 text-[11.5px] opacity-70">غرف صوتية، هدايا فاخرة وأصدقاء جدد</p>
      <div className="flex-1" />
      <div className="auth-option w-full space-y-3 rounded-3xl login-glass p-4">
        <p className="text-center text-[15px] font-black">{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}</p>
        <p className="text-center text-[11.5px] opacity-70">{mode === "login" ? "ادخل إلى حسابك واحتفظ ببياناتك وأصدقائك" : "أنشئ حسابك في صدى شات باستخدام بريدك وكلمة مرور"}</p>
        <div className="flex gap-2 rounded-2xl bg-black/10 p-1">
          <button type="button" className={mode === "login" ? activeTab : idleTab} onClick={() => { setMode("login"); setNotice(""); }}>تسجيل الدخول</button>
          <button type="button" className={mode === "signup" ? activeTab : idleTab} onClick={() => { setMode("signup"); setNotice(""); }}>حساب جديد</button>
        </div>
        {mode === "signup" && <input aria-label="الاسم" type="text" required minLength={2} dir="rtl" autoComplete="name" placeholder="الاسم" className={field} value={name} onChange={e => setName(e.target.value)} disabled={busy} />}
        <input aria-label="البريد الإلكتروني" type="email" required dir="ltr" autoComplete="email" placeholder="name@email.com" className={field} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
        <input aria-label="كلمة المرور" type="password" required minLength={8} dir="ltr" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="كلمة المرور" className={field} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
        {notice && <p role="status" className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-center text-[11.5px] font-bold leading-relaxed text-night-foreground">{notice}</p>}
        <Button type="button" disabled={busy} onClick={() => void run()} className="h-12 w-full rounded-xl text-[14px] font-bold">{busy ? "جارٍ..." : mode === "login" ? "دخول" : "إنشاء الحساب"}</Button>
      </div>
      <p className="mt-3 text-center text-[10.5px] leading-relaxed opacity-60">بمتابعتك أنت توافق على شروط الاستخدام وسياسة الخصوصية</p>
    </div>
  </div>;
}
