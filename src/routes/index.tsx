import { icons3d, roomBackground } from "@/lib/assets3d";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Users, Lock, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MediaImage } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CATEGORIES, COUNTRIES, SEAT_OPTIONS, catName, errMsg, flagOf } from "@/lib/vox";

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
  component: () => (
    <AppShell>
      <Home />
    </AppShell>
  ),
});

type Room = { id: string; room_no: number; name: string; description: string | null; category: string; country: string; member_count: number; is_private: boolean; seat_count: number; created_at: string; cover_url?: string | null };
type RoomBanner = { id: string; title: string; image_url: string; target_url?: string | null; sort_order: number; is_active: boolean; starts_at?: string | null; ends_at?: string | null };

function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tab, setTab] = useState<"hot" | "new">("hot");
  const [country, setCountry] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
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
      if (brand.logo_path) {
        const { data: signed } = await supabase.storage.from("admin-assets").createSignedUrl(brand.logo_path, 3600);
        if (alive) setLogoUrl(signed?.signedUrl ?? null);
      }
      if (banner.enabled !== false && banner.image_path && !sessionStorage.getItem("vox_intro_seen")) {
        const { data: signed } = await supabase.storage.from("admin-assets").createSignedUrl(banner.image_path, 3600);
        if (alive && signed?.signedUrl) {
          sessionStorage.setItem("vox_intro_seen", "1");
          setIntroBannerUrl(signed.signedUrl);
          setShowIntroBanner(true);
          timer = setTimeout(() => setShowIntroBanner(false), 5000);
        }
      }
    }
    void loadBranding();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);


  async function loadBanners() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("banners")
      .select("id,title,image_url,target_url,sort_order,is_active,starts_at,ends_at")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return;
    const active = ((data ?? []) as RoomBanner[]).filter((b) => (!b.starts_at || b.starts_at <= now) && (!b.ends_at || b.ends_at >= now));
    setRoomBanners(active);
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
    let r = rooms.filter((x) => (!country || x.country === country) && (!cat || x.category === cat));
    if (q.trim()) r = r.filter((x) => x.name.includes(q.trim()) || String(x.room_no) === q.trim());
    return [...r].sort((a, b) => (tab === "hot" ? b.member_count - a.member_count : +new Date(b.created_at) - +new Date(a.created_at)));
  }, [rooms, tab, country, cat, q]);

  return (
    <div className="app-screen home-discovery w-full px-3 pb-3 pt-2 sm:px-4">
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
        <div className="room-list-banner mb-2 overflow-hidden rounded-xl border border-primary/20 bg-black/20 shadow-lg">
          {(() => {
            const banner = roomBanners[bannerIndex];
            if (!banner) return null;
            const content = (
              <div className="relative h-[88px] w-full sm:h-32">
                <img src={banner.image_url} alt={banner.title} className="absolute inset-0 h-full w-full object-cover" />
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
      <div className="relative mb-2">
        <img src={icons3d.search} alt="" className="absolute right-3 top-1.5 h-7 w-7 object-contain" />
        <Input className="pr-10" placeholder="ابحث باسم الغرفة أو رقمها" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-2 flex gap-2">
        {(["hot", "new"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-gold" : "glass text-muted-foreground"}`}>
            {t === "hot" ? "🔥 الشائعة" : "✨ الجديدة"}
          </button>
        ))}
      </div>
      <div className="room-filter-row mb-2 flex flex-wrap items-center gap-1.5">
        <Chip active={!country} onClick={() => setCountry(null)}>🌍 الكل</Chip>
        {COUNTRIES.map((c) => (
          <Chip key={c.code} active={country === c.code} onClick={() => setCountry(c.code)}>{c.flag} {c.name}</Chip>
        ))}
      </div>
      <div className="room-filter-row mb-3 flex flex-wrap items-center gap-1.5">
        <Chip active={!cat} onClick={() => setCat(null)}>كل التصنيفات</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">لا توجد غرف بعد — أنشئ أول غرفة!</div>
      ) : (
        <div className="grid grid-cols-2 justify-items-stretch gap-1.5 sm:gap-2">
          {list.map((r) => (
            <Link key={r.id} to="/room/$id" params={{ id: r.id }} className="card-3d glass group relative aspect-[4/5] overflow-hidden rounded-2xl p-2.5">
              <MediaImage src={r.cover_url || roomBackground(r.category)} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
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
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`room-filter-chip shrink-0 rounded-full px-2.5 py-1 text-[13px] leading-5 ${active ? "bg-secondary text-primary ring-1 ring-primary" : "glass text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function CreateRoom() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const [open, setOpen] = useState(!!search.create);
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
    <Dialog open={open} onOpenChange={setOpen}>
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
