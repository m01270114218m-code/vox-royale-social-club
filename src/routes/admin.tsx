import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, Flag, DoorOpen, FileText, Users, Trash2, Wallet, Gift, Store, Bell, ScrollText, Image as ImageIcon, Box, Upload, Search, Power, RefreshCw, File as FileIcon, Armchair, PanelsTopLeft, Settings, BarChart3, ShieldCheck, ExternalLink } from "lucide-react";
import { AdminRolesTab, AnalyticsTab, BannersTab, NotificationsTab, SeatsTab, SettingsTab } from "@/components/admin/AdminExtendedTabs";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMsg } from "@/lib/vox";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — VOX ROYALE" },
      { name: "description", content: "لوحة إدارة VOX ROYALE للبلاغات والغرف والمنشورات والمستخدمين." },
      { property: "og:title", content: "لوحة التحكم — VOX ROYALE" },
      { property: "og:description", content: "إدارة البلاغات والغرف والمنشورات والمستخدمين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AdminPage />
    </RequireAuth>
  ),
});

type Tab = "reports" | "rooms" | "seats" | "posts" | "users" | "wallet" | "gifts" | "vip" | "store" | "assets" | "banners" | "notifications" | "roles" | "settings" | "analytics" | "audit";
const fmt = (d: string) => new Date(d).toLocaleString("ar-EG");

function AdminPage() {
  const { user } = useAuth();
  const externalAdminUrl = import.meta.env.VITE_ADMIN_PANEL_URL as string | undefined;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [tab, setTab] = useState<Tab>("reports");

  async function check() {
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.rpc("is_admin", { _uid: user!.id }),
      supabase.rpc("has_role", { _user_id: user!.id, _role: "super_admin" }),
    ]);
    setAllowed(!!a);
    setIsSuper(!!s);
    if (a) {
      const { data } = await supabase.rpc("admin_stats");
      setStats(data as Record<string, number>);
    }
  }
  useEffect(() => { void check(); }, [user?.id]);

  async function refreshStats() {
    if (!allowed) return;
    const { data, error } = await supabase.rpc("admin_stats");
    if (!error && data) setStats(data as Record<string, number>);
  }
  useAdminRealtime(
    allowed ? ["profiles", "wallets", "wallet_transactions", "rooms", "room_members", "room_seats", "gifts", "gift_transactions", "vip_tiers", "banners", "notifications", "admin_assets", "reports", "user_roles", "admin_settings", "audit_log", "store_items", "posts"] : [],
    refreshStats,
  );

  async function claim() {
    const { data, error } = await supabase.rpc("claim_first_admin");
    if (error) { toast.error(errMsg(error)); return; }
    if (!data) { toast.error("يوجد مشرف بالفعل — اطلب منه منحك الصلاحية"); return; }
    toast.success("أصبحت المشرف الأعلى");
    check();
  }

  if (allowed === null) return <div className="p-10 text-center text-muted-foreground">جارٍ التحقق…</div>;
  if (!allowed)
    return (
      <div className="mx-auto max-w-md p-6 pt-20 text-center">
        <Shield className="mx-auto h-14 w-14 text-primary" />
        <h1 className="font-display text-gold mt-4 text-3xl">لوحة التحكم</h1>
        <p className="mt-2 text-sm text-muted-foreground">ليست لديك صلاحية إدارة. إذا لم يكن هناك مشرف بعد يمكنك المطالبة بالصلاحية كأول مشرف.</p>
        <Button className="mt-6 w-full bg-gold" onClick={claim}>المطالبة بصلاحية المشرف الأول</Button>
        <Link to="/" className="mt-4 block text-sm text-muted-foreground">العودة للتطبيق</Link>
      </div>
    );

  const tabs: { id: Tab; label: string; icon: typeof Flag }[] = [
    { id: "reports", label: "البلاغات", icon: Flag },
    { id: "rooms", label: "الغرف", icon: DoorOpen },
    { id: "seats", label: "المقاعد", icon: Armchair },
    { id: "posts", label: "المنشورات", icon: FileText },
    { id: "users", label: "المستخدمون", icon: Users },
    { id: "wallet", label: "المحافظ", icon: Wallet },
    { id: "gifts", label: "الهدايا", icon: Gift },
    { id: "vip", label: "مستويات VIP", icon: Shield },
    { id: "store", label: "المتجر", icon: Store },
    { id: "assets", label: "الأصول ثلاثية الأبعاد", icon: ImageIcon },
    { id: "banners", label: "البانرات", icon: PanelsTopLeft },
    { id: "notifications", label: "الإشعارات", icon: Bell },
    { id: "roles", label: "صلاحيات الإدارة", icon: ShieldCheck },
    { id: "settings", label: "الإعدادات", icon: Settings },
    { id: "analytics", label: "التحليلات", icon: BarChart3 },
    { id: "audit", label: "سجل الإجراءات", icon: ScrollText },
  ];
  // Keep dashboard cards aligned with the keys returned by public.admin_stats().
  const statLabels: Record<string, string> = {
    users: "المستخدمون",
    rooms: "الغرف",
    seats: "المقاعد",
    vip_users: "مستخدمو VIP",
    wallet_coins: "إجمالي العملات",
    wallet_diamonds: "إجمالي الماسات",
    gifts: "الهدايا",
    reports_open: "البلاغات المفتوحة",
    assets: "الأصول",
    banners: "الإعلانات",
    notifications: "الإشعارات",
  };

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 py-3">
        <h1 className="font-display text-gold text-3xl">لوحة التحكم</h1>
        <div className="flex items-center gap-2">
          {externalAdminUrl && (
            <a href={externalAdminUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-4 w-4" /> اللوحة الخارجية</Button>
            </a>
          )}
          <Link to="/" className="text-sm text-muted-foreground">← التطبيق</Link>
        </div>
      </header>
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(statLabels).map(([k, l]) => (
            <div key={k} className="card-3d glass rounded-2xl p-3">
              <div className="text-2xl font-bold text-primary">{Number(stats[k] ?? 0).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === t.id ? "bg-gold" : "glass"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "reports" && <Reports />}
        {tab === "rooms" && <Rooms />}
        {tab === "seats" && <SeatsTab />}
        {tab === "posts" && <Posts />}
        {tab === "users" && <UsersTab isSuper={isSuper} />}
        {tab === "wallet" && <WalletTab />}
        {tab === "gifts" && <GiftsTab />}
        {tab === "vip" && <VipTab />}
        {tab === "store" && <StoreTab />}
        {tab === "assets" && <AssetsTab />}
        {tab === "banners" && <BannersTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "roles" && <AdminRolesTab isSuper={isSuper} />}
        {tab === "settings" && <SettingsTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

type Report = { id: string; reporter_name: string | null; target_type: string; target_id: string | null; category: string; details: string; status: string; admin_reply: string | null; created_at: string };
const STATUS: Record<string, string> = { open: "مفتوح", reviewing: "قيد المراجعة", resolved: "تم الحل", rejected: "مرفوض" };

function Reports() {
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState<Report[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  async function load() {
    const { data, error } = await supabase.rpc("admin_list_reports", { _status: status });
    if (error) toast.error(errMsg(error));
    setRows((data as Report[]) ?? []);
  }
  useEffect(() => { load(); }, [status]);
  useAdminRealtime(["reports"], load);
  async function act(id: string, s: string) {
    const { error } = await supabase.rpc("admin_resolve_report", { _report: id, _status: s, _reply: reply[id] ?? "" });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم التحديث");
    load();
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {["open", "reviewing", "resolved", "rejected", ""].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs ${status === s ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>{s ? STATUS[s] : "الكل"}</button>
        ))}
      </div>
      {rows.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">لا توجد بلاغات</p>}
      {rows.map((r) => (
        <div key={r.id} className="glass space-y-2 rounded-2xl p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <b>{r.category} · {r.target_type}</b>
            <span className="text-xs text-muted-foreground">{STATUS[r.status]} · {fmt(r.created_at)}</span>
          </div>
          <p>{r.details}</p>
          <div className="text-xs text-muted-foreground">المبلّغ: {r.reporter_name ?? "—"} · الهدف: <span dir="ltr">{r.target_id ?? "—"}</span></div>
          {r.admin_reply && <div className="text-xs text-primary">الرد: {r.admin_reply}</div>}
          <Input placeholder="رد المشرف (اختياري)" value={reply[r.id] ?? ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => act(r.id, "reviewing")}>قيد المراجعة</Button>
            <Button size="sm" className="bg-gold" onClick={() => act(r.id, "resolved")}>تم الحل</Button>
            <Button size="sm" variant="destructive" onClick={() => act(r.id, "rejected")}>رفض</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Rooms() {
  const [rows, setRows] = useState<{ id: string; room_no: number; name: string; member_count: number; created_at: string; is_private: boolean }[]>([]);
  const [q, setQ] = useState("");
  async function load() {
    let query = supabase.from("rooms").select("id,room_no,name,member_count,created_at,is_private").order("created_at", { ascending: false }).limit(100);
    if (q) query = /^\d+$/.test(q) ? query.eq("room_no", Number(q)) : query.ilike("name", `%${q}%`);
    const { data } = await query;
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);
  useAdminRealtime(["rooms", "room_members"], load);
  async function del(id: string) {
    if (!confirm("حذف الغرفة نهائياً؟")) return;
    const { error } = await supabase.rpc("admin_delete_room", { _room: id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم الحذف");
    load();
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرقم" /><Button onClick={load}>بحث</Button></div>
      {rows.map((r) => (
        <div key={r.id} className="glass flex items-center justify-between gap-2 rounded-2xl p-3 text-sm">
          <Link to="/room/$id" params={{ id: r.id }} className="min-w-0">
            <div className="truncate font-bold">{r.name} {r.is_private && "🔒"}</div>
            <div className="text-xs text-muted-foreground">#{r.room_no} · {r.member_count} عضو · {fmt(r.created_at)}</div>
          </Link>
          <Button size="icon" variant="destructive" onClick={() => del(r.id)} aria-label="حذف"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}

function Posts() {
  const [rows, setRows] = useState<{ id: string; body: string; like_count: number; created_at: string; profiles: { display_name: string } | null }[]>([]);
  async function load() {
    const { data } = await supabase.from("posts").select("id,body,like_count,created_at,profiles(display_name)").order("created_at", { ascending: false }).limit(100);
    setRows((data as never) ?? []);
  }
  useEffect(() => { load(); }, []);
  useAdminRealtime(["posts"], load);
  async function del(id: string) {
    if (!confirm("حذف المنشور؟")) return;
    const { error } = await supabase.rpc("admin_delete_post", { _post: id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم الحذف");
    load();
  }
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">لا توجد منشورات</p>}
      {rows.map((p) => (
        <div key={p.id} className="glass flex items-start justify-between gap-2 rounded-2xl p-3 text-sm">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{p.profiles?.display_name} · {fmt(p.created_at)} · ❤ {p.like_count}</div>
            <p className="line-clamp-3">{p.body}</p>
          </div>
          <Button size="icon" variant="destructive" onClick={() => del(p.id)} aria-label="حذف"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}

type U = { id: string; display_name: string; display_no: number; level: number; vip_level: number; coins: number; roles: string[]; created_at: string };
function UsersTab({ isSuper }: { isSuper: boolean }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<U[]>([]);
  const [amt, setAmt] = useState<Record<string, string>>({});
  async function load() {
    const { data, error } = await supabase.rpc("admin_list_users", { _q: q });
    if (error) toast.error(errMsg(error));
    setRows((data as U[]) ?? []);
  }
  useEffect(() => { load(); }, []);
  useAdminRealtime(["profiles", "wallets", "user_roles"], load);
  async function run(p: PromiseLike<{ error: unknown }>, msg: string) {
    const { error } = await p;
    if (error) { toast.error(errMsg(error as never)); return; }
    toast.success(msg);
    load();
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو ID" /><Button onClick={load}>بحث</Button></div>
      {rows.map((u) => (
        <div key={u.id} className="glass space-y-2 rounded-2xl p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <Link to="/u/$id" params={{ id: u.id }} className="font-bold">{u.display_name} <span className="text-xs text-muted-foreground">ID {u.display_no}</span></Link>
            <span className="text-xs">Lv {u.level} · VIP {u.vip_level} · 🪙 {Number(u.coins).toLocaleString()} {u.roles.length > 0 && `· ${u.roles.join(", ")}`}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-28" type="number" placeholder="عملات ±" value={amt[u.id] ?? ""} onChange={(e) => setAmt({ ...amt, [u.id]: e.target.value })} />
            <Button size="sm" onClick={() => run(supabase.rpc("admin_grant_coins", { _user: u.id, _amount: Number(amt[u.id] || 0) }), "تم تعديل الرصيد")}>تطبيق</Button>
            <select className="rounded-md border border-input bg-input px-2 py-1.5 text-xs" value={u.vip_level} onChange={(e) => run(supabase.rpc("admin_set_vip", { _user: u.id, _vip: Number(e.target.value) }), "تم تعديل VIP")}>
              {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>VIP {i}</option>)}
            </select>
            {isSuper && (["admin", "moderator"] as const).map((r) => {
              const has = u.roles.includes(r);
              return <Button key={r} size="sm" variant={has ? "destructive" : "outline"} onClick={() => run(supabase.rpc("admin_set_role", { _user: u.id, _role: r, _grant: !has }), "تم تحديث الصلاحية")}>{has ? `إزالة ${r}` : `منح ${r}`}</Button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type WalletTx = { user_id: string; display_name: string | null; amount: number; kind: string; note: string; created_at: string };
function WalletTab() {
  const [rows, setRows] = useState<WalletTx[]>([]);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_list_wallet_tx", { _limit: 200 });
      if (error) toast.error(errMsg(error));
      setRows((data as WalletTx[]) ?? []);
    })();
  }, []);
  useAdminRealtime(["wallet_transactions", "wallets"], () => { void supabase.rpc("admin_list_wallet_tx", { _limit: 200 }).then(({ data, error }) => { if (error) toast.error(errMsg(error)); setRows((data as WalletTx[]) ?? []); }); });
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">لا توجد معاملات</p>}
      {rows.map((t, i) => (
        <div key={i} className="glass flex items-center justify-between gap-2 rounded-2xl p-3 text-sm">
          <div>
            <b>{t.display_name ?? "مستخدم"}</b>
            <div className="text-xs text-muted-foreground">{t.kind} · {t.note} · {fmt(t.created_at)}</div>
          </div>
          <b className={t.amount >= 0 ? "text-green-400" : "text-red-400"}>{t.amount >= 0 ? "+" : ""}{Number(t.amount).toLocaleString()} 🪙</b>
        </div>
      ))}
    </div>
  );
}

type GiftTx = { sender_name: string | null; receiver_name: string | null; gift_name: string; cost: number; created_at: string };
type GiftCatalog = { id: string; name: string; emoji: string; price: number; active: boolean };
function GiftsTab() {
  const [rows, setRows] = useState<GiftTx[]>([]);
  const [catalog, setCatalog] = useState<GiftCatalog[]>([]);
  const [form, setForm] = useState({ id: "", name: "", emoji: "🎁", price_coins: "100" });
  async function load() {
    const [{ data, error }, { data: gifts, error: catalogError }] = await Promise.all([
      supabase.rpc("admin_list_gift_tx", { _limit: 200 }),
      supabase.from("gifts").select("id,name,emoji,price,active").order("price"),
    ]);
    if (error) toast.error(errMsg(error));
    if (catalogError) toast.error(errMsg(catalogError));
    setRows((data as GiftTx[]) ?? []);
    setCatalog((gifts as GiftCatalog[]) ?? []);
  }
  useEffect(() => { load(); }, []);
  useAdminRealtime(["gifts", "gift_transactions"], load);
  async function saveGift() {
    const id = form.id.trim() || form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `gift-${Date.now()}`;
    if (!id || !form.name.trim() || !form.emoji.trim() || Number(form.price_coins) < 0) {
      toast.error("أدخل معرفاً واسم الهدية ورمزها وسعراً صحيحاً"); return;
    }
    const { error } = await supabase.from("gifts").upsert({ id, name: form.name.trim(), emoji: form.emoji.trim(), price: Number(form.price_coins), active: true });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم حفظ الهدية في الكتالوج");
    setForm({ id: "", name: "", emoji: "🎁", price_coins: "100" });
    load();
  }
  async function toggleGift(g: GiftCatalog) {
    const { error } = await supabase.from("gifts").update({ active: !g.active }).eq("id", g.id);
    if (error) { toast.error(errMsg(error)); return; }
    load();
  }
  async function deleteGift(g: GiftCatalog) {
    if (!confirm("حذف الهدية من الكتالوج؟")) return;
    const { error } = await supabase.from("gifts").delete().eq("id", g.id);
    if (error) { toast.error(errMsg(error)); return; }
    load();
  }
  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-2xl p-4">
        <b>إدارة كتالوج الهدايا</b>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="معرّف اختياري" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} dir="ltr" />
          <Input placeholder="اسم الهدية" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="الرمز أو الإيموجي" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
          <Input type="number" min="0" placeholder="السعر بالعملات" value={form.price_coins} onChange={(e) => setForm({ ...form, price_coins: e.target.value })} />
        </div>
        <Button className="bg-gold" onClick={saveGift}>حفظ الهدية</Button>
      </div>
      {catalog.map((g) => (
        <div key={g.id} className="glass flex items-center justify-between gap-2 rounded-xl p-3 text-sm">
          <div><b>{g.emoji} {g.name}</b><div className="text-xs text-muted-foreground" dir="ltr">{g.id} · {g.price} coins</div></div>
          <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => toggleGift(g)}>{g.active ? "إيقاف" : "تفعيل"}</Button><Button size="sm" variant="destructive" onClick={() => deleteGift(g)}>حذف</Button></div>
        </div>
      ))}
      <div className="border-t border-border pt-3"><b>سجل إرسال الهدايا</b></div>
      {rows.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">لا توجد معاملات</p>}
      {rows.map((g, i) => (
        <div key={i} className="glass flex items-center justify-between gap-2 rounded-2xl p-3 text-sm">
          <div><b>{g.sender_name ?? "—"}</b> أرسل <b className="text-primary">{g.gift_name}</b> إلى <b>{g.receiver_name ?? "—"}</b><div className="text-xs text-muted-foreground">{fmt(g.created_at)}</div></div>
          <b>🪙 {Number(g.cost).toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}

type VipTier = { level: number; name: string; price_coins: number; duration_days: number };
function VipTab() {
  const [rows, setRows] = useState<VipTier[]>([]);
  const [form, setForm] = useState({ level: "1", name: "", price_coins: "1000", duration_days: "30" });
  async function load() {
    const { data, error } = await supabase.from("vip_tiers").select("level,name,price_coins,duration_days").order("level");
    if (error) toast.error(errMsg(error));
    setRows((data as VipTier[]) ?? []);
  }
  useEffect(() => { load(); }, []);
  useAdminRealtime(["vip_tiers", "profiles"], load);
  async function save() {
    const level = Number(form.level), price = Number(form.price_coins), days = Number(form.duration_days);
    if (!Number.isInteger(level) || level < 1 || level > 10 || !form.name.trim() || price < 0 || days < 1) {
      toast.error("تحقق من المستوى والاسم والسعر والمدة"); return;
    }
    const { error } = await supabase.from("vip_tiers").upsert({ level, name: form.name.trim(), price_coins: price, duration_days: days });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم حفظ مستوى VIP");
    load();
  }
  async function remove(level: number) {
    if (!confirm("حذف مستوى VIP؟")) return;
    const { error } = await supabase.from("vip_tiers").delete().eq("level", level);
    if (error) { toast.error(errMsg(error)); return; }
    load();
  }
  return (
    <div className="space-y-3">
      <div className="glass space-y-2 rounded-2xl p-4">
        <b>إضافة أو تعديل مستوى VIP</b>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min="1" max="10" placeholder="المستوى" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
          <Input placeholder="اسم المستوى" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="number" min="0" placeholder="السعر بالعملات" value={form.price_coins} onChange={(e) => setForm({ ...form, price_coins: e.target.value })} />
          <Input type="number" min="1" placeholder="المدة بالأيام" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} />
        </div>
        <Button className="bg-gold" onClick={save}>حفظ المستوى</Button>
      </div>
      {rows.map((v) => (
        <div key={v.level} className="glass flex items-center justify-between gap-2 rounded-xl p-3 text-sm">
          <div><b>VIP {v.level} · {v.name}</b><div className="text-xs text-muted-foreground">🪙 {v.price_coins.toLocaleString()} · {v.duration_days} يوم</div></div>
          <Button size="sm" variant="destructive" onClick={() => remove(v.level)}>حذف</Button>
        </div>
      ))}
    </div>
  );
}

type StoreRow = { id: string; kind: string; name: string; description: string | null; price: number; asset_key: string; sort_order: number };
const KINDS: Record<string, string> = { frame: "إطار", entry: "دخولية", name_effect: "تأثير اسم", theme: "خلفية" };
function StoreTab() {
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [form, setForm] = useState({ kind: "frame", name: "", description: "", price: "100", asset_key: "", sort_order: "0" });
  async function load() {
    const { data } = await supabase.from("store_items").select("*").order("kind").order("sort_order");
    setRows((data as StoreRow[]) ?? []);
  }
  useEffect(() => { load(); }, []);
  useAdminRealtime(["store_items"], load);
  async function save() {
    const { error } = await supabase.rpc("admin_save_store_item", {
      _id: null as unknown as string, _kind: form.kind, _name: form.name, _description: form.description,
      _price: Number(form.price || 0), _asset_key: form.asset_key, _sort_order: Number(form.sort_order || 0),
    });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تمت الإضافة");
    setForm({ kind: "frame", name: "", description: "", price: "100", asset_key: "", sort_order: "0" });
    load();
  }
  async function del(id: string) {
    if (!confirm("حذف العنصر من المتجر؟")) return;
    const { error } = await supabase.rpc("admin_delete_store_item", { _id: id });
    if (error) { toast.error(errMsg(error)); return; }
    load();
  }
  return (
    <div className="space-y-3">
      <div className="glass space-y-2 rounded-2xl p-4">
        <b className="text-sm">إضافة عنصر جديد</b>
        <div className="grid grid-cols-2 gap-2">
          <select className="rounded-md border border-input bg-input px-2 py-1.5 text-xs" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Input placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input type="number" placeholder="السعر بالعملات" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Input placeholder="مفتاح الأصل (مثل frame-1)" value={form.asset_key} onChange={(e) => setForm({ ...form, asset_key: e.target.value })} dir="ltr" />
          <Input type="number" placeholder="الترتيب" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
        </div>
        <Button size="sm" className="bg-gold" onClick={save} disabled={!form.name || !form.asset_key}>إضافة</Button>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="glass flex items-center justify-between gap-2 rounded-2xl p-3 text-sm">
          <div><b>{r.name}</b> <span className="text-xs text-muted-foreground">({KINDS[r.kind] ?? r.kind})</span>
            <div className="text-xs text-muted-foreground" dir="ltr">{r.asset_key}</div>
          </div>
          <div className="flex items-center gap-2">
            <b>🪙 {r.price.toLocaleString()}</b>
            <Button size="icon" variant="destructive" onClick={() => del(r.id)} aria-label="حذف"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BroadcastTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  async function send() {
    setSending(true);
    const { data, error } = await supabase.rpc("admin_broadcast", { _title: title, _body: body });
    setSending(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(`وصل الإشعار إلى ${Number(data).toLocaleString()} مستخدم`);
    setTitle(""); setBody("");
  }
  return (
    <div className="glass mx-auto max-w-md space-y-3 rounded-2xl p-4">
      <b>إرسال إشعار لجميع المستخدمين</b>
      <Input placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="min-h-24 w-full rounded-md border border-input bg-input px-3 py-2 text-sm" placeholder="نص الإشعار" value={body} onChange={(e) => setBody(e.target.value)} />
      <Button className="w-full bg-gold" onClick={send} disabled={sending || !title || !body}>{sending ? "جارٍ الإرسال…" : "إرسال للجميع"}</Button>
    </div>
  );
}

type AuditRow = { id: string; admin_name: string | null; action: string; target_type: string; target_id: string; details: string; created_at: string };
function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_list_audit", { _limit: 200 });
      if (error) toast.error(errMsg(error));
      setRows((data as AuditRow[]) ?? []);
    })();
  }, []);
  useAdminRealtime(["audit_log"], () => { void supabase.rpc("admin_list_audit", { _limit: 200 }).then(({ data, error }) => { if (error) toast.error(errMsg(error)); setRows((data as AuditRow[]) ?? []); }); });
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">لا توجد إجراءات مسجلة بعد</p>}
      {rows.map((a) => (
        <div key={a.id} className="glass rounded-2xl p-3 text-sm">
          <div className="flex justify-between gap-2">
            <b>{a.admin_name ?? "مشرف"} · {a.action}</b>
            <span className="text-xs text-muted-foreground">{fmt(a.created_at)}</span>
          </div>
          <div className="text-xs text-muted-foreground">{a.target_type} <span dir="ltr">{a.target_id}</span> {a.details}</div>
        </div>
      ))}
    </div>
  );
}


type AdminAsset = {
  id: string;
  asset_key: string;
  name: string;
  category: string;
  url: string | null;
  metadata: { storage_path?: string; content_type?: string; size?: number } | null;
  is_active: boolean;
  created_at: string;
};
const ASSET_CATEGORIES: Record<string, string> = {
  general: "عام",
  ui: "عناصر الواجهة",
  room: "الغرف والخلفيات",
  gift: "الهدايا",
  frame: "إطارات الصور",
  vip: "شارات VIP",
  level: "المستويات",
  banner: "البانرات",
  avatar: "الصور الشخصية",
  "3d": "مجسمات ثلاثية الأبعاد",
};
const ASSET_BUCKET = "admin-assets";
const MAX_ASSET_SIZE = 50 * 1024 * 1024;

function AssetsTab() {
  const [rows, setRows] = useState<AdminAsset[]>([]);
  const [category, setCategory] = useState("general");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("admin_assets").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) {
      toast.error(errMsg(error));
      setLoading(false);
      return;
    }
    const assets = (data ?? []) as unknown as AdminAsset[];
    setRows(assets);
    const signed: Record<string, string> = {};
    await Promise.all(assets.map(async (asset) => {
      const path = asset.metadata?.storage_path ?? asset.url;
      if (!path) return;
      const { data: result } = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(path, 3600);
      if (result?.signedUrl) signed[asset.id] = result.signedUrl;
    }));
    setPreviews(signed);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useAdminRealtime(["admin_assets"], load);

  async function uploadAssets() {
    if (!files.length) {
      toast.error("اختر ملفاً واحداً على الأقل");
      return;
    }
    const invalid = files.find((file) => file.size > MAX_ASSET_SIZE);
    if (invalid) {
      toast.error(`حجم ${invalid.name} أكبر من الحد المسموح (50 ميجابايت)`);
      return;
    }
    setUploading(true);
    let uploaded = 0;
    for (const file of files) {
      const cleanName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "asset";
      const path = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${cleanName}`;
      const { error: storageError } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (storageError) {
        toast.error(`فشل رفع ${file.name}: ${storageError.message}`);
        continue;
      }
      const assetKey = `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const { error: rowError } = await supabase.from("admin_assets").insert({
        asset_key: assetKey,
        name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
        category,
        url: path,
        metadata: { storage_path: path, content_type: file.type || "application/octet-stream", size: file.size, original_name: file.name },
        is_active: true,
      });
      if (rowError) {
        await supabase.storage.from(ASSET_BUCKET).remove([path]);
        toast.error(`تم رفع الملف لكن تعذرت إضافته للمكتبة: ${rowError.message}`);
        continue;
      }
      uploaded += 1;
    }
    setUploading(false);
    setFiles([]);
    setName("");
    const picker = document.getElementById("admin-asset-files") as HTMLInputElement | null;
    if (picker) picker.value = "";
    if (uploaded) toast.success(`تم رفع وإضافة ${uploaded} أصل بنجاح`);
    await load();
  }

  async function toggleAsset(asset: AdminAsset) {
    const { error } = await supabase.from("admin_assets").update({ is_active: !asset.is_active, updated_at: new Date().toISOString() }).eq("id", asset.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(asset.is_active ? "تم إيقاف الأصل عن الظهور في التطبيق" : "تم تفعيل الأصل");
    await load();
  }

  async function deleteAsset(asset: AdminAsset) {
    if (!confirm(`حذف الأصل «${asset.name}» نهائياً؟`)) return;
    const path = asset.metadata?.storage_path ?? asset.url;
    if (path) {
      const { error } = await supabase.storage.from(ASSET_BUCKET).remove([path]);
      if (error) { toast.error(`تعذر حذف الملف: ${error.message}`); return; }
    }
    const { error } = await supabase.from("admin_assets").delete().eq("id", asset.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم حذف الأصل والملف المرتبط به");
    await load();
  }

  const visible = rows.filter((asset) =>
    (filter === "all" || asset.category === filter) &&
    (asset.name.toLowerCase().includes(search.toLowerCase()) || asset.asset_key.toLowerCase().includes(search.toLowerCase()))
  );
  const isImage = (asset: AdminAsset) => (asset.metadata?.content_type ?? "").startsWith("image/");
  const isModel = (asset: AdminAsset) => /model\/gltf|octet-stream/i.test(asset.metadata?.content_type ?? "") || /\.(glb|gltf)$/i.test(asset.name);

  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">مكتبة أصول التطبيق</h2>
            <p className="text-xs text-muted-foreground">ارفع الصور ومجسمات GLB/GLTF لتخزينها وربطها بمحتوى التطبيق.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs">{rows.length} أصل</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">تصنيف الأصل</span>
            <select className="w-full rounded-md border border-input bg-input px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(ASSET_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">اسم الأصل (اختياري)</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تاج VIP ذهبي" />
          </label>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-secondary/40 p-5 text-center">
          <Upload className="h-7 w-7 text-primary" />
          <span className="text-sm font-semibold">اختر صوراً أو ملفات ثلاثية الأبعاد</span>
          <span className="text-xs text-muted-foreground">PNG · JPG · WEBP · GIF · SVG · GLB · GLTF — حتى 50 MB للملف</span>
          <input id="admin-asset-files" className="max-w-full text-xs" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.glb,.gltf,model/gltf-binary,model/gltf+json,application/octet-stream" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} ملف محدد · {files.map((f) => f.name).join("، ")}</p>}
        <Button className="w-full bg-gold" onClick={uploadAssets} disabled={uploading || files.length === 0}>
          {uploading ? "جارٍ رفع الأصول…" : `رفع وإضافة ${files.length || ""} أصل`}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-40 flex-1"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم الأصل أو مفتاحه" /></div>
        <select className="rounded-md border border-input bg-input px-3 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">كل التصنيفات</option>
          {Object.entries(ASSET_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <Button size="icon" variant="outline" onClick={load} disabled={loading} aria-label="تحديث"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      {visible.length === 0 && <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">{loading ? "جارٍ تحميل المكتبة…" : "لا توجد أصول مطابقة. ارفع أول أصل من النموذج أعلاه."}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((asset) => (
          <div key={asset.id} className="glass min-w-0 overflow-hidden rounded-2xl">
            <div className="flex aspect-square items-center justify-center bg-secondary/60 p-2">
              {previews[asset.id] && isImage(asset) ? (
                <img src={previews[asset.id]} alt={asset.name} className="h-full w-full object-contain" />
              ) : isModel(asset) ? (
                <div className="text-center"><Box className="mx-auto h-12 w-12 text-primary" /><span className="mt-2 block text-xs">مجسم ثلاثي الأبعاد</span></div>
              ) : (
                <div className="text-center"><FileIcon className="mx-auto h-10 w-10 text-muted-foreground" /><span className="mt-2 block text-xs">ملف أصل</span></div>
              )}
            </div>
            <div className="space-y-2 p-3">
              <div className="truncate text-sm font-semibold" title={asset.name}>{asset.name}</div>
              <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                <span>{ASSET_CATEGORIES[asset.category] ?? asset.category}</span>
                <span>{asset.metadata?.size ? `${(asset.metadata.size / 1024 / 1024).toFixed(1)} MB` : ""}</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className={`rounded-full px-2 py-1 text-[10px] ${asset.is_active ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>{asset.is_active ? "نشط" : "متوقف"}</span>
                <div className="flex gap-1">
                  {previews[asset.id] && <a href={previews[asset.id]} target="_blank" rel="noreferrer" className="rounded-md p-1.5 hover:bg-secondary" title="فتح الملف"><Search className="h-4 w-4" /></a>}
                  <button onClick={() => toggleAsset(asset)} className="rounded-md p-1.5 hover:bg-secondary" title={asset.is_active ? "إيقاف" : "تفعيل"}><Power className="h-4 w-4" /></button>
                  <button onClick={() => deleteAsset(asset)} className="rounded-md p-1.5 text-destructive hover:bg-secondary" title="حذف"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="truncate text-[10px] text-muted-foreground" dir="ltr">{asset.asset_key}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
