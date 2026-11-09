import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { icons3d } from "@/lib/assets3d";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Phone, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — صدى شات" },
      { name: "description", content: "سجّل دخولك إلى صدى شات للانضمام للغرف الصوتية." },
      { property: "og:title", content: "تسجيل الدخول — صدى شات" },
      { property: "og:description", content: "انضم للغرف الصوتية المباشرة." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [appName, setAppName] = useState("صدى شات");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [authMethods, setAuthMethods] = useState({ email_enabled: true, quick_enabled: true, google_enabled: true, phone_enabled: true });
  const [phoneMode, setPhoneMode] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function loadPublicBranding() {
      const { data, error } = await supabase.from("admin_settings").select("key,value").in("key", ["app_branding", "home_banner", "auth_methods"]);
      if (error || !alive) return;
      const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value as Record<string, unknown>]));
      const brand = (settings.app_branding ?? {}) as { app_name?: string; logo_path?: string };
      const banner = (settings.home_banner ?? {}) as { title?: string; image_path?: string; enabled?: boolean };
      const methods = (settings.auth_methods ?? {}) as { email_enabled?: boolean; quick_enabled?: boolean; google_enabled?: boolean; phone_enabled?: boolean };
      if (alive) setAuthMethods({ email_enabled: methods.email_enabled !== false, quick_enabled: methods.quick_enabled !== false, google_enabled: methods.google_enabled !== false, phone_enabled: methods.phone_enabled !== false });
      if (brand.app_name) setAppName(brand.app_name);
      if (brand.logo_path) {
        const { data: signed } = await supabase.storage.from("admin-assets").createSignedUrl(brand.logo_path, 3600);
        if (alive) setLogoUrl(signed?.signedUrl ?? null);
      }
      if (banner.enabled !== false && banner.image_path && !sessionStorage.getItem("vox_intro_seen")) {
        const { data: signed } = await supabase.storage.from("admin-assets").createSignedUrl(banner.image_path, 3600);
        if (alive && signed?.signedUrl) {
          sessionStorage.setItem("vox_intro_seen", "1");
          setBannerTitle(banner.title || "");
          setBannerUrl(signed.signedUrl);
          setShowBanner(true);
          timer = setTimeout(() => setShowBanner(false), 5000);
        }
      }
    }
    void loadPublicBranding();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (user) nav({ to: "/" });
  }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب، افتح بريدك لتأكيده");
        setMode("in");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("أرسلنا رابط استعادة كلمة المرور إلى بريدك");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoneOtp() {
    const value = phone.trim();
    if (!/^\\+[1-9]\\d{7,14}$/.test(value)) {
      toast.error("اكتب الرقم بصيغة دولية مثل +2010xxxxxxxx");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: value, options: { shouldCreateUser: true } });
      if (error) throw error;
      toast.success("تم إرسال رمز SMS");
    } catch (err) {
      toast.error((err as Error).message || "تعذر إرسال رمز SMS");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhoneOtp() {
    if (!otp.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: otp.trim(), type: "sms" });
      if (error) throw error;
      toast.success("تم تسجيل الدخول بنجاح");
    } catch (err) {
      toast.error((err as Error).message || "رمز التفعيل غير صحيح");
    } finally {
      setBusy(false);
    }
  }

  async function quick() {
    setBusy(true);
    try {
      const { data: current, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (current.session?.user) {
        toast.info("أنت مسجل الدخول بالفعل.");
        return;
      }
      let dev = localStorage.getItem("vox_device_id");
      if (!dev) {
        dev = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID() + crypto.randomUUID()
          : "vox-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
        localStorage.setItem("vox_device_id", dev);
      }
      const saved = localStorage.getItem("vox_guest_refresh");
      if (saved) {
        const { data: restored, error: restoreError } = await supabase.auth.refreshSession({ refresh_token: saved });
        if (!restoreError && restored.session) {
          localStorage.setItem("vox_guest_refresh", restored.session.refresh_token);
          toast.success("أهلاً بعودتك");
          return;
        }
        localStorage.removeItem("vox_guest_refresh");
      }
      const { data: guest, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (!guest.user || !guest.session) throw new Error("لم يتم إنشاء جلسة دخول سريعة");
      const { error: deviceError } = await supabase.rpc("register_device", { _device: dev });
      if (deviceError) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("تعذر ربط الحساب بهذا الجهاز: " + deviceError.message);
      }
      localStorage.setItem("vox_guest_refresh", guest.session.refresh_token);
      toast.success("تم إنشاء حساب سريع لهذا الجهاز");
    } catch (err) {
      toast.error((err as Error).message || "تعذر تسجيل الدخول السريع");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const redirectTo = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined) || window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message || "تعذر بدء تسجيل الدخول باستخدام Google");
      setBusy(false);
    }
  }

  const methodCards = [
    { key: "email_enabled" as const, label: "البريد الإلكتروني", icon: Mail, tone: "from-sky-500/30 to-blue-600/10", action: () => { setPhoneMode(false); setMode("in"); } },
    { key: "google_enabled" as const, label: "Google", icon: null, tone: "from-red-500/20 to-yellow-500/10", action: google },
    { key: "phone_enabled" as const, label: "رقم الهاتف", icon: Phone, tone: "from-emerald-500/25 to-cyan-500/10", action: () => { setPhoneMode(true); setMode("in"); } },
    { key: "quick_enabled" as const, label: "دخول سريع", icon: KeyRound, tone: "from-amber-500/30 to-orange-500/10", action: quick },
  ].filter((m) => authMethods[m.key]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#4b3a12_0%,transparent_38%),linear-gradient(145deg,#070707,#15120a)] px-5 py-8">
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      {showBanner && bannerUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4">
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-gold/40 shadow-2xl">
            <img src={bannerUrl} alt={bannerTitle || "بنر البداية"} className="max-h-[78vh] w-full object-contain" />
            {bannerTitle && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-5 pt-12 text-center text-xl font-bold text-white">{bannerTitle}</div>}
            <button type="button" onClick={() => setShowBanner(false)} className="absolute right-3 top-3 rounded-full bg-black/70 px-4 py-2 text-sm text-white">تخطي</button>
          </div>
        </div>
      )}
      <div className="relative z-10 m-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-[2rem] border border-gold/40 bg-gradient-to-br from-gold/25 to-black shadow-[0_20px_60px_rgba(0,0,0,.5)]">
            {logoUrl ? <img src={logoUrl} alt={appName} className="h-full w-full rounded-[2rem] object-contain p-2" /> : <img src={icons3d.micHost} alt={appName} className="h-20 w-20 object-contain" />}
          </div>
          <h1 className="font-display text-4xl font-black text-gold drop-shadow-lg">{appName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">دخول آمن وسريع إلى عالم الغرف الصوتية</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          {methodCards.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" disabled={busy} onClick={() => void item.action()} className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${item.tone} p-4 text-right shadow-xl transition hover:-translate-y-1 hover:border-gold/50 active:scale-[.98]`}>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-black/25 text-white shadow-inner">
                  {Icon ? <Icon className="h-6 w-6" /> : <span className="text-2xl font-black text-white">G</span>}
                </div>
                <div className="font-bold text-white">{item.label}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-white/55">دخول حقيقي <ArrowRight className="h-3 w-3" /></div>
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="glass rounded-[2rem] border border-white/10 p-5 shadow-2xl">
          {authMethods.email_enabled && !phoneMode && (
            <>
              {mode === "up" && <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} />}
              <div className="relative mt-3">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
                <Input className="pl-10" type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
              </div>
              {mode !== "reset" && <Input className="mt-3" type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" />}
              <Button type="submit" disabled={busy} className="mt-3 w-full bg-gold font-bold text-black shadow-gold">{mode === "in" ? "تسجيل الدخول" : mode === "up" ? "إنشاء حساب" : "إرسال رابط الاستعادة"}</Button>
            </>
          )}

          {authMethods.phone_enabled && phoneMode && mode === "in" && (
            <div className="rounded-2xl border border-primary/15 bg-background/30 p-4">
              <div className="mb-3 flex items-center gap-2 font-bold"><Phone className="h-5 w-5 text-gold" /> تسجيل الدخول برقم الهاتف</div>
              <Input inputMode="tel" dir="ltr" placeholder="+2010xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} />
              {otp && <Input inputMode="numeric" dir="ltr" placeholder="رمز SMS" value={otp} onChange={e => setOtp(e.target.value)} className="mt-2" maxLength={8} />}
              <Button type="button" disabled={busy} onClick={() => void (otp.trim() ? verifyPhoneOtp() : sendPhoneOtp())} className="mt-2 w-full bg-primary font-bold">{otp.trim() ? "تأكيد الرمز والدخول" : "إرسال رمز SMS"}</Button>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-400" /> الجلسة محفوظة على هذا الجهاز</div>

          {authMethods.email_enabled && !phoneMode && (
            <div className="flex justify-between pt-4 text-sm text-muted-foreground">
              {mode === "reset" ? <button type="button" onClick={() => setMode("in")}>العودة إلى تسجيل الدخول</button> : <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "حساب جديد" : "لدي حساب"}</button>}
              {mode !== "reset" && <button type="button" onClick={() => setMode("reset")}>نسيت كلمة المرور؟</button>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
