import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, Flag, DoorOpen, FileText, Users, Trash2, Wallet, Gift, Store, Bell, ScrollText } from "lucide-react";
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

type Tab = "reports" | "rooms" | "posts" | "users" | "wallet" | "gifts" | "store" | "broadcast" | "audit";
const fmt = (d: string) => new Date(d).toLocaleString("ar-EG");

function AdminPage() {
  const { user } = useAuth();
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
  useEffect(() => { check(); }, [user]);

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
    { id: "posts", label: "المنشورات", icon: FileText },
    { id: "users", label: "المستخدمون", icon: Users },
    { id: "wallet", label: "المحافظ", icon: Wallet },
    { id: "gifts", label: "الهدايا", icon: Gift },
    { id: "store", label: "المتجر", icon: Store },
    { id: "broadcast", label: "إشعار عام", icon: Bell },
    { id: "audit", label: "سجل الإجراءات", icon: ScrollText },
  ];
  const statLabels: Record<string, string> = { users: "المستخدمون", rooms: "الغرف", posts: "المنشورات", families: "العائلات", open_reports: "بلاغات مفتوحة", gifts: "الهدايا", coins: "إجمالي العملات" };

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="flex items-center justify-between py-3">
        <h1 className="font-display text-gold text-3xl">لوحة التحكم</h1>
        <Link to="/" className="text-sm text-muted-foreground">← التطبيق</Link>
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
        {tab === "posts" && <Posts />}
        {tab === "users" && <UsersTab isSuper={isSuper} />}
        {tab === "wallet" && <WalletTab />}
        {tab === "gifts" && <GiftsTab />}
        {tab === "store" && <StoreTab />}
        {tab === "broadcast" && <BroadcastTab />}
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
function GiftsTab() {
  const [rows, setRows] = useState<GiftTx[]>([]);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_list_gift_tx", { _limit: 200 });
      if (error) toast.error(errMsg(error));
      setRows((data as GiftTx[]) ?? []);
    })();
  }, []);
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">لا توجد هدايا</p>}
      {rows.map((g, i) => (
        <div key={i} className="glass flex items-center justify-between gap-2 rounded-2xl p-3 text-sm">
          <div><b>{g.sender_name ?? "—"}</b> أرسل <b className="text-primary">{g.gift_name}</b> إلى <b>{g.receiver_name ?? "—"}</b>
            <div className="text-xs text-muted-foreground">{fmt(g.created_at)}</div>
          </div>
          <b>🪙 {Number(g.cost).toLocaleString()}</b>
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
  async function save() {
    const { error } = await supabase.rpc("admin_save_store_item", {
      _id: null, _kind: form.kind, _name: form.name, _description: form.description,
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
