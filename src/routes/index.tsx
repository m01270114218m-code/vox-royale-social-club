import { icons3d, roomBackground } from "@/lib/assets3d";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Users, Lock, Bell, Smartphone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MediaImage } from "@/components/UserAvatar";
import { AdminAssetMedia } from "@/components/AdminAssetMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CATEGORIES, COUNTRIES, SEAT_OPTIONS, catName, errMsg, flagOf } from "@/lib/vox";
import { getAdminAssetUrl } from "@/lib/media";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الغرف الصوتية — صدي شات" },
      { name: "description", content: "اكتشف الغرف الصوتية الشائعة والجديدة حسب الدولة والتصنيف." },
      { property: "og:title", content: "الغرف الصوتية — صدي شات" },
      { property: "og:description", content: "اكتشف الغرف الصوتية الشائعة والجديدة." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { create?: number } => (s["create"] ? { create: 1 } : {}),
  component: LoginGate,
});


function LoginGate() {
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    if (window.localStorage.getItem("vox_royale_authenticated") === "1") setAuthenticated(true);
  }, []);
  if (authenticated) return <HomeRouteComponent />;
  return <LoginScreen onSuccess={() => {
    window.localStorage.setItem("vox_royale_authenticated", "1");
    setAuthenticated(true);
  }} />;
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<"home" | "phone" | "otp">("home");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const primary = "login-primary";
  const field = "login-field";

  return (
    <main className="login-screen" dir="rtl">
      <div className="login-glow login-glow-a" />
      <div className="login-glow login-glow-b" />
      <div className="login-panel">
        <div className="login-brand">
          <div className="login-logo">صدى</div>
          <p>غرف صوتية بلا حدود</p>
        </div>

        <div key={step} className="login-actions">
          {step === "home" && (
            <>
              <button onClick={onSuccess} className={primary}>
                <GoogleLogo /> تسجيل الدخول بـ Google
              </button>
              <div className="login-divider"><span /> أو <span /></div>
              <button onClick={() => setStep("phone")} aria-label="الدخول برقم الهاتف" className="login-phone-button">
                <Smartphone className="h-7 w-7" />
              </button>
              <p className="login-hint">يمكنك الدخول برقم الهاتف عبر كود التحقق</p>
            </>
          )}

          {step === "phone" && (
            <div className="login-card">
              <button onClick={() => setStep("home")} className="login-back"><ArrowRight className="h-4 w-4" /> رجوع</button>
              <h2>الدخول برقم الهاتف</h2>
              <div dir="ltr" className="flex gap-2">
                <select className={field + " px-3"}>
                  <option>🇪🇬 +20</option><option>🇸🇦 +966</option><option>🇦🇪 +971</option><option>🇰🇼 +965</option>
                </select>
                <input inputMode="tel" value={phone} placeholder="10 1234 5678" onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className={field + " min-w-0 flex-1 px-4"} />
              </div>
              <button disabled={phone.length < 8} onClick={() => setStep("otp")} className={primary}>إرسال الكود</button>
            </div>
          )}

          {step === "otp" && (
            <div className="login-card">
              <button onClick={() => setStep("phone")} className="login-back"><ArrowRight className="h-4 w-4" /> تعديل الرقم</button>
              <h2>كود التحقق</h2>
              <p>أدخل الكود المرسل إلى <bdi dir="ltr">+20 {phone}</bdi></p>
              <div dir="ltr" className="flex justify-between gap-2">
                {code.map((v, i) => (
                  <input key={i} ref={(el) => { refs.current[i] = el; }} value={v} maxLength={1} inputMode="numeric"
                    aria-label={"الرقم " + (i + 1)}
                    onChange={(e) => { const d=e.target.value.replace(/\D/g,""); const n=[...code]; n[i]=d; setCode(n); if(d && i<5) refs.current[i+1]?.focus(); }}
                    onKeyDown={(e) => { if(e.key==="Backspace" && !code[i] && i>0) refs.current[i-1]?.focus(); }}
                    className={field + " h-12 w-12 text-center text-xl font-bold"} />
                ))}
              </div>
              <button disabled={code.join("").length < 6} onClick={onSuccess} className={primary}>تأكيد والدخول</button>
              <p className="text-center text-sm">لم يصلك الكود؟ <button className="font-bold underline">إعادة الإرسال</button></p>
            </div>
          )}

          <p className="login-terms">بتسجيل الدخول توافق على <a>اتفاقية المستخدم</a> و<a>سياسة الخصوصية</a></p>
        </div>
      </div>
    </main>
  );
}

type Room = { id: string; room_no: number; name: string; description: string | null; category: string; country: string; member_count: number; is_private: boolean; seat_count: number; created_at: string; cover_url?: string | null; room_frame_asset_key?: string | null; sort_order?: number };
type RoomBanner = { id: string; title: string; image_url: string; resolved_image_url?: string | null; target_url?: string | null; sort_order: number; is_active: boolean; starts_at?: string | null; ends_at?: string | null };

function HomeRouteComponent() {
  const search = Route.useSearch();
  return <AppShell><HomeScreen createRequested={!!search.create} /></AppShell>;
}

export function HomeScreen({ createRequested = false }: { createRequested?: boolean }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tab, setTab] = useState<"hot" | "new">("hot");
  const [userIdSearch, setUserIdSearch] = useState("");
  const [appBranding, setAppBranding] = useState<{ app_name?: string; logo_path?: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [introBanner, setIntroBanner] = useState<{ title?: string; image_path?: string; enabled?: boolean } | null>(null);
  const [introBannerUrl, setIntroBannerUrl] = useState<string | null>(null);
  const [showIntroBanner, setShowIntroBanner] = useState(false);
  const [roomBanners, setRoomBanners] = useState<RoomBanner[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function loadBranding() {
      const { data, error } = await supabase.from("admin_settings").select("key,value").in("key", ["app_branding", "home_banner"]);
      if (error || !alive) return;
      const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value as Record<string, unknown>]));
      const brand = (settings.app_branding ?? {}) as { app_name?: string; logo_path?: string };
      const banner = (settings.home_banner ?? {}) as { title?: string; image_path?: string; enabled?: boolean; duration_seconds?: number };
      setAppBranding(brand);
      setIntroBanner(banner);
      const resolveStorageImage = async (value?: string | null) => {
        if (!value) return null;
        const resolved = await getAdminAssetUrl(value);
        if (resolved) return resolved;
        if (/^https?:\/\//i.test(value) || value.startsWith("media:")) return null;
        const { data } = await supabase.storage.from("admin-assets").createSignedUrl(value.replace(/^\/+/, ""), 3600);
        return data?.signedUrl ?? null;
      };
      if (brand.logo_path) {
        const resolved = await resolveStorageImage(brand.logo_path);
        if (alive) setLogoUrl(resolved);
      }
      if (banner.enabled !== false && banner.image_path && !sessionStorage.getItem("vox_intro_seen")) {
        const resolved = await resolveStorageImage(banner.image_path);
        if (alive && resolved) {
          sessionStorage.setItem("vox_intro_seen", "1");
          setIntroBannerUrl(resolved);
          setShowIntroBanner(true);
          timer = setTimeout(() => setShowIntroBanner(false), 5000);
        }
      }
    }
    void loadBranding();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);


  async function searchUserById() {
    const value = Number(userIdSearch.trim());
    if (!Number.isSafeInteger(value) || value < 1) { toast.error("أدخل ID مستخدم صحيح"); return; }
    const { data, error } = await supabase.from("profiles").select("id,display_no").eq("display_no", value).maybeSingle();
    if (error) { toast.error(errMsg(error)); return; }
    if (!data) { toast.error("لم يتم العثور على مستخدم بهذا ID"); return; }
    setUserIdSearch("");
    window.location.href = `/u/${data.id}`;
  }

  async function loadBanners() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("banners")
      .select("id,title,image_url,target_url,sort_order,is_active,starts_at,ends_at")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      toast.error("تعذر تحميل البانرات: " + error.message);
      return;
    }
    const active = ((data ?? []) as RoomBanner[]).filter((b) => (!b.starts_at || b.starts_at <= now) && (!b.ends_at || b.ends_at >= now));
    const resolved = await Promise.all(active.map(async (banner) => {
      const imageValue = (banner.image_url || "").trim();
      const resolvedUrl = await getAdminAssetUrl(imageValue);
      // Signed URLs can still be displayed while valid if refreshing them fails.
      const isHttpUrl = imageValue.startsWith("https://") || imageValue.startsWith("http://");
      const fallbackUrl = isHttpUrl ? imageValue : null;
      const storagePath = imageValue.startsWith("media:") ? null : imageValue;
      const storageUrl = !resolvedUrl && !fallbackUrl && storagePath
        ? (await supabase.storage.from("admin-assets").createSignedUrl(storagePath.split("/").filter(Boolean).join("/"), 3600)).data?.signedUrl ?? null
        : null;
      return { ...banner, resolved_image_url: resolvedUrl || fallbackUrl || storageUrl };
    }));
    setRoomBanners(resolved);
    setBannerIndex(0);
  }

  async function load() {
    const { data, error } = await supabase.from("rooms").select("*").limit(100);
    if (error) toast.error(error.message);
    else setRooms(data as Room[]);
  }
  useEffect(() => {
    void load();
    void loadBanners();
    const channel = supabase
      .channel("home-room-list-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "banners" }, () => { void loadBanners(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (roomBanners.length < 2) return;
    const timer = window.setInterval(() => setBannerIndex((i) => (i + 1) % roomBanners.length), 5000);
    return () => window.clearInterval(timer);
  }, [roomBanners.length]);

  const list = useMemo(() => {
    return [...rooms].sort((a, b) => { const ao=Number(a.sort_order ?? 0), bo=Number(b.sort_order ?? 0); if (ao !== bo) return ao-bo; return tab === "hot" ? b.member_count-a.member_count : +new Date(b.created_at)-+new Date(a.created_at); });
  }, [rooms, tab]);

  return (
    <div className="app-screen w-full px-3 pb-3 pt-2 sm:px-4">
      {showIntroBanner && introBannerUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" role="dialog" aria-label="إعلان البداية">
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-gold/40 shadow-2xl">
            <img src={introBannerUrl} alt={introBanner?.title || "بنر البداية"} className="max-h-[78vh] w-full object-contain" />
            {introBanner?.title && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-5 pt-12 text-center text-xl font-bold text-white">{introBanner.title}</div>}
            <button onClick={() => setShowIntroBanner(false)} className="absolute right-3 top-3 rounded-full bg-black/70 px-4 py-2 text-sm text-white">تخطي</button>
          </div>
        </div>
      )}
      {roomBanners.length > 0 && (
        <div className="room-list-banner mb-4 overflow-hidden rounded-3xl border border-primary/30 bg-black/30 shadow-xl">
          {(() => {
            const banner = roomBanners[bannerIndex];
            if (!banner) return null;
            const content = (
              <div className="relative h-[132px] w-full sm:h-44">
                <img src={banner.resolved_image_url || ""} alt={banner.title} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent px-4 pb-3 pt-10">
                  <div className="truncate text-sm font-bold text-white">{banner.title}</div>
                </div>
                {roomBanners.length > 1 && (
                  <div className="absolute bottom-2 left-3 flex gap-1.5">
                    {roomBanners.map((b, i) => <span key={b.id} className={`h-1.5 rounded-full ${i === bannerIndex ? "w-5 bg-gold" : "w-1.5 bg-white/60"}`} />)}
                  </div>
                )}
              </div>
            );
            return banner.target_url ? <a href={banner.target_url} target="_blank" rel="noreferrer">{content}</a> : content;
          })()}
        </div>
      )}
      <div className="mb-3 flex gap-2"><Input className="flex-1" inputMode="numeric" dir="ltr" placeholder="ابحث عن مستخدم بالـ ID" value={userIdSearch} onChange={(e) => setUserIdSearch(e.target.value.replace(/\D/g, ""))} /><Button variant="outline" onClick={() => void searchUserById()}><Search className="h-4 w-4" /> مستخدم</Button></div>
      <div className="mb-2 flex gap-2">
        {(["hot", "new"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "rounded-full px-4 py-1.5 text-sm font-bold bg-gold" : "rounded-full px-4 py-1.5 text-sm font-bold glass text-muted-foreground"}>
            {t === "hot" ? "🔥 الشائعة" : "✨ الجديدة"}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">لا توجد غرف بعد — أنشئ أول غرفة!</div>
      ) : (
        <div className="grid grid-cols-2 justify-items-stretch gap-2 sm:gap-3">
          {list.map((r) => (
            <Link key={r.id} to="/room/$id" params={{ id: r.id }} className="card-3d glass group relative aspect-[3/4] overflow-hidden rounded-3xl p-3">
              <MediaImage src={r.cover_url || roomBackground(r.category)} className="absolute inset-0 h-full w-full object-cover" />{r.room_frame_asset_key && <RoomFrameOverlay assetKey={r.room_frame_asset_key} />}<div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="relative flex h-full flex-col justify-between">
                <span className="w-fit rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{catName(r.category)}</span>
                <div />
                <div>
                  <div className="flex items-center gap-1 font-bold">
                    {flagOf(r.country)} <span className="truncate">{r.name}</span> {r.is_private && <Lock className="h-3 w-3" />}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>#{r.room_no}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.member_count}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="fixed bottom-24 left-4 z-30">
        <CreateRoom createRequested={createRequested} />
      </div>
    </div>
  );
}

function RoomFrameOverlay({ assetKey }: { assetKey: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { void getAdminAssetUrl(assetKey).then(setSrc); }, [assetKey]);
  return src ? <AdminAssetMedia src={src} className="pointer-events-none absolute inset-0 z-10 h-full w-full object-fill" /> : null;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`room-filter-chip shrink-0 rounded-full px-2.5 py-1 text-[13px] leading-5 ${active ? "bg-secondary text-primary ring-1 ring-primary" : "glass text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function CreateRoom({ createRequested = false }: { createRequested?: boolean }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(createRequested);
  useEffect(() => {
    if (createRequested) setOpen(true);
  }, [createRequested]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("chat");
  const [country, setCountry] = useState("EG");
  const [seats, setSeats] = useState(8);
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_room", { _name: name, _description: desc, _category: category, _country: country, _seat_count: seats, _is_private: priv });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    setOpen(false);
    nav({ to: "/room/$id", params: { id: data as string } });
  }
  const sel = "w-full rounded-md border border-input bg-input px-3 py-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next && createRequested) void nav({ to: "/", search: {} });
    }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gold rounded-full font-bold shadow-gold"><img src={icons3d.plus} alt="" className="h-6 w-6 object-contain" /> غرفة</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle className="font-display text-gold">إنشاء غرفة</DialogTitle></DialogHeader>
        <form onSubmit={create} className="space-y-3">
          <Input placeholder="اسم الغرفة" required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="وصف (اختياري)" maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className={sel} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={sel} value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-sm text-muted-foreground">عدد المقاعد</div>
            <div className="flex flex-wrap gap-2">
              {SEAT_OPTIONS.map((n) => (
                <button type="button" key={n} onClick={() => setSeats(n)} className={`h-10 w-12 rounded-xl font-bold ${seats === n ? "bg-gold" : "glass"}`}>{n}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> غرفة خاصة</label>
          <Button type="submit" disabled={busy} className="w-full bg-gold font-bold">إنشاء</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
