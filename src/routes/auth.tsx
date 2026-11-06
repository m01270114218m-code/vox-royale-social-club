import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — VOX ROYALE" },
      { name: "description", content: "سجّل دخولك إلى VOX ROYALE للانضمام للغرف الصوتية." },
      { property: "og:title", content: "تسجيل الدخول — VOX ROYALE" },
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
  const [appName, setAppName] = useState("VOX ROYALE");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [authMethods, setAuthMethods] = useState({ email_enabled: true, quick_enabled: true, google_enabled: true });

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function loadPublicBranding() {
      const { data, error } = await supabase.from("admin_settings").select("key,value").in("key", ["app_branding", "home_banner", "auth_methods"]);
      if (error || !alive) return;
      const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value as Record<string, unknown>]));
      const brand = (settings.app_branding ?? {}) as { app_name?: string; logo_path?: string };
      const banner = (settings.home_banner ?? {}) as { title?: string; image_path?: string; enabled?: boolean };
      const methods = (settings.auth_methods ?? {}) as { email_enabled?: boolean; quick_enabled?: boolean; google_enabled?: boolean };
      if (alive) setAuthMethods({ email_enabled: methods.email_enabled !== false, quick_enabled: methods.quick_enabled !== false, google_enabled: methods.google_enabled !== false });
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

  async function quick() {
    setBusy(true);
    try {
      const { data: current, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (current.session?.user.is_anonymous) {
        toast.success("أهلاً بك مجدداً");
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
          toast.success("أهلاً بعودتك إلى حسابك");
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
      const message = (err as Error).message || "";
      if (message.toLowerCase().includes("anonymous") || message.includes("anonymous_provider_disabled")) {
        toast.error("الدخول السريع غير مفعّل في إعدادات Supabase حالياً. فعّل Anonymous Sign-ins من Authentication ثم Sign In / Providers.");
      } else {
        toast.error(message || "تعذر تسجيل الدخول السريع");
      }
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
      const message = (err as Error).message || "";
      if (message.toLowerCase().includes("provider is not enabled")) {
        toast.error("تسجيل Google غير مفعّل في Supabase. فعّل Google من Authentication ثم Sign In / Providers وأدخل بيانات OAuth.");
      } else {
        toast.error(message || "تعذر بدء تسجيل الدخول باستخدام Google");
      }
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {showBanner && bannerUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" role="dialog" aria-label="بنر البداية">
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-gold/40 shadow-2xl">
            <img src={bannerUrl} alt={bannerTitle || "بنر البداية"} className="max-h-[78vh] w-full object-contain" />
            {bannerTitle && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-5 pt-12 text-center text-xl font-bold text-white">{bannerTitle}</div>}
            <button type="button" onClick={() => setShowBanner(false)} className="absolute right-3 top-3 rounded-full bg-black/70 px-4 py-2 text-sm text-white">تخطي</button>
          </div>
        </div>
      )}
      <div className="floaty mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gold shadow-gold">
        {logoUrl ? <img src={logoUrl} alt={appName} className="h-full w-full object-contain p-2" /> : <Crown className="h-12 w-12" />}
      </div>
      <h1 className="font-display text-gold text-4xl">{appName}</h1>
      <p className="mb-8 mt-2 text-muted-foreground">غرف صوتية بمستوى ملكي</p>
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-3 rounded-3xl p-6">
        {authMethods.email_enabled && <>
        {mode === "up" && <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} />}
        <Input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
        {mode !== "reset" && (
          <Input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" />
        )}
        <Button type="submit" disabled={busy} className="w-full bg-gold font-bold shadow-gold">
          {mode === "in" ? "دخول" : mode === "up" ? "إنشاء حساب" : "إرسال رابط الاستعادة"}
        </Button>
        </>}
        {authMethods.quick_enabled && mode === "in" && (
          <Button type="button" disabled={busy} onClick={quick} className="w-full bg-accent text-accent-foreground font-bold">
            ⚡ دخول سريع (حساب لهذا الجهاز)
          </Button>
        )}
        {authMethods.google_enabled && mode !== "reset" && (
          <Button type="button" disabled={busy} variant="outline" onClick={google} className="w-full">
            المتابعة باستخدام Google
          </Button>
        )}
        {authMethods.email_enabled && <div className="flex justify-between pt-2 text-sm text-muted-foreground">
          {mode === "reset" ? (
            <button type="button" onClick={() => setMode("in")}>العودة إلى تسجيل الدخول</button>
          ) : (
            <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "حساب جديد" : "لدي حساب"}
            </button>
          )}
          {mode !== "reset" && <button type="button" onClick={() => setMode("reset")}>نسيت كلمة المرور؟</button>}
        </div>}
      </form>
    </div>
  );
}
