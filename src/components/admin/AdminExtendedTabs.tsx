import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMsg } from "@/lib/vox";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";

const fmt = (value: string) => new Date(value).toLocaleString("ar-EG");

type SeatRow = {
  room_id: string;
  seat_index: number;
  is_locked: boolean;
  is_muted: boolean;
  user_id: string | null;
  rooms: { name: string; room_no: number } | null;
  profiles: { display_name: string; display_no: number } | null;
};

export function SeatsTab() {
  const [rows, setRows] = useState<SeatRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    let request = supabase.from("room_seats")
      .select("room_id,seat_index,is_locked,is_muted,user_id,rooms(name,room_no),profiles(display_name,display_no)")
      .order("room_id").order("seat_index").limit(300);
    const { data, error } = await request;
    if (error) toast.error(errMsg(error));
    const normalized = ((data ?? []) as unknown as SeatRow[]).filter((row) =>
      !query || row.rooms?.name?.toLowerCase().includes(query.toLowerCase()) ||
      String(row.rooms?.room_no ?? "").includes(query) ||
      row.profiles?.display_name?.toLowerCase().includes(query.toLowerCase())
    );
    setRows(normalized);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [query]);
  useAdminRealtime(["room_seats", "room_members"], load);
  async function act(row: SeatRow, action: string) {
    const { error } = await supabase.rpc("admin_seat_action", {
      _room: row.room_id, _seat: row.seat_index, _action: action,
    });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم تحديث المقعد");
    await load();
  }
  return <div className="space-y-3">
    <div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم الغرفة أو العضو أو رقمها" /><Button variant="outline" onClick={() => void load()} disabled={loading}>تحديث</Button></div>
    {rows.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">{loading ? "جارٍ التحميل…" : "لا توجد مقاعد في قاعدة البيانات بعد"}</p>}
    {rows.map((row) => <div key={row.room_id + ":" + row.seat_index} className="glass space-y-2 rounded-xl p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{row.rooms?.name ?? "غرفة"} · مقعد {row.seat_index + 1}</b>
        <span className="text-xs text-muted-foreground">{row.profiles?.display_name ?? "مقعد فارغ"} {row.profiles?.display_no ? "· ID " + row.profiles.display_no : ""}</span>
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        <span className={row.is_locked ? "rounded-full bg-destructive/15 px-2 py-1 text-destructive" : "rounded-full bg-secondary px-2 py-1"}>{row.is_locked ? "مقفل" : "مفتوح"}</span>
        <span className={row.is_muted ? "rounded-full bg-destructive/15 px-2 py-1 text-destructive" : "rounded-full bg-secondary px-2 py-1"}>{row.is_muted ? "مكتوم" : "الصوت متاح"}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => void act(row, row.is_locked ? "unlock" : "lock")}>{row.is_locked ? "فتح" : "قفل"}</Button>
        <Button size="sm" variant="outline" onClick={() => void act(row, row.is_muted ? "unmute" : "mute")}>{row.is_muted ? "إلغاء الكتم" : "كتم"}</Button>
        {row.user_id && <Button size="sm" variant="destructive" onClick={() => { if (confirm("إخلاء المقعد؟")) void act(row, "kick"); }}>إخلاء المقعد</Button>}
      </div>
    </div>)}
  </div>;
}

type Banner = { id: string; title: string; image_url: string; target_url: string | null; is_active: boolean; sort_order: number; starts_at: string | null; ends_at: string | null };
export function BannersTab() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [form, setForm] = useState({ title: "", image_url: "", target_url: "", sort_order: "0" });
  async function load() {
    const { data, error } = await supabase.from("banners").select("*").order("sort_order").order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(errMsg(error));
    setRows((data ?? []) as Banner[]);
  }
  useEffect(() => { void load(); }, []);
  useAdminRealtime(["banners"], load);
  async function save() {
    if (!form.title.trim() || !/^https?:\/\//i.test(form.image_url.trim())) { toast.error("أدخل عنواناً ورابط صورة صحيحاً"); return; }
    const { error } = await supabase.from("banners").insert({
      title: form.title.trim(), image_url: form.image_url.trim(),
      target_url: form.target_url.trim() || null, sort_order: Number(form.sort_order) || 0, is_active: true,
    });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم نشر البانر في قاعدة بيانات التطبيق");
    setForm({ title: "", image_url: "", target_url: "", sort_order: "0" });
    await load();
  }
  async function toggle(row: Banner) {
    const { error } = await supabase.from("banners").update({ is_active: !row.is_active, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) { toast.error(errMsg(error)); return; }
    await load();
  }
  async function remove(row: Banner) {
    if (!confirm("حذف هذا البانر؟")) return;
    const { error } = await supabase.from("banners").delete().eq("id", row.id);
    if (error) { toast.error(errMsg(error)); return; }
    await load();
  }
  return <div className="space-y-3">
    <div className="glass space-y-2 rounded-2xl p-4">
      <b>إضافة بانر يظهر داخل التطبيق</b>
      <Input placeholder="عنوان البانر" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Input placeholder="رابط الصورة HTTPS" dir="ltr" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
      <Input placeholder="رابط الوجهة (اختياري)" dir="ltr" value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} />
      <Input type="number" placeholder="الترتيب" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
      <Button className="bg-gold" onClick={() => void save()}>نشر البانر</Button>
    </div>
    {rows.map((row) => <div key={row.id} className="glass flex items-center gap-3 rounded-xl p-3 text-sm">
      <img src={row.image_url} alt="" className="h-14 w-20 rounded-lg object-cover" />
      <div className="min-w-0 flex-1"><b>{row.title}</b><div className="truncate text-xs text-muted-foreground" dir="ltr">{row.image_url}</div><span className="text-xs">{row.is_active ? "نشط" : "متوقف"} · ترتيب {row.sort_order}</span></div>
      <div className="flex flex-col gap-1"><Button size="sm" variant="outline" onClick={() => void toggle(row)}>{row.is_active ? "إيقاف" : "تفعيل"}</Button><Button size="sm" variant="destructive" onClick={() => void remove(row)}>حذف</Button></div>
    </div>)}
  </div>;
}

type NotificationRow = { id: string; user_id: string; title: string; body: string; kind: string; is_read: boolean; created_at: string };
export function NotificationsTab() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  async function load() {
    const { data, error } = await supabase.from("notifications").select("id,user_id,title,body,kind,is_read,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) toast.error(errMsg(error));
    setRows((data ?? []) as NotificationRow[]);
  }
  useEffect(() => { void load(); }, []);
  useAdminRealtime(["notifications"], load);
  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    const { data, error } = await supabase.rpc("admin_broadcast", { _title: title.trim(), _body: body.trim() });
    setSending(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم إرسال الإشعار إلى " + Number(data ?? 0).toLocaleString("ar-EG") + " حساب");
    setTitle(""); setBody("");
    await load();
  }
  return <div className="space-y-3">
    <div className="glass space-y-2 rounded-2xl p-4">
      <b>إرسال إشعار حقيقي لكل مستخدمي التطبيق</b>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإشعار" />
      <textarea className="min-h-24 w-full rounded-md border border-input bg-input px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} placeholder="محتوى الإشعار" />
      <Button className="bg-gold" disabled={sending || !title.trim() || !body.trim()} onClick={() => void send()}>{sending ? "جارٍ الإرسال…" : "إرسال للجميع"}</Button>
    </div>
    <div className="flex items-center justify-between"><b>آخر الإشعارات المسجلة</b><Button size="sm" variant="outline" onClick={() => void load()}>تحديث</Button></div>
    {rows.map((row) => <div key={row.id} className="glass rounded-xl p-3 text-sm">
      <div className="flex justify-between gap-2"><b>{row.title}</b><span className="text-xs text-muted-foreground">{fmt(row.created_at)}</span></div>
      <p className="mt-1">{row.body}</p><div className="text-xs text-muted-foreground" dir="ltr">user: {row.user_id} · {row.kind} · {row.is_read ? "read" : "unread"}</div>
    </div>)}
  </div>;
}

type RoleUser = { id: string; display_name: string; display_no: number; roles: string[] };
export function AdminRolesTab({ isSuper }: { isSuper: boolean }) {
  const [rows, setRows] = useState<RoleUser[]>([]);
  const [query, setQuery] = useState("");
  async function load() {
    const { data, error } = await supabase.rpc("admin_list_users", { _q: query });
    if (error) toast.error(errMsg(error));
    setRows(((data ?? []) as RoleUser[]).filter((user) => user.roles.length > 0));
  }
  useEffect(() => { void load(); }, []);
  useAdminRealtime(["user_roles", "profiles"], load);
  async function change(user: RoleUser, role: "admin" | "moderator", grant: boolean) {
    if (!isSuper) { toast.error("إدارة الصلاحيات متاحة للمشرف الأعلى فقط"); return; }
    const { error } = await supabase.rpc("admin_set_role", { _user: user.id, _role: role, _grant: grant });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم تحديث دور المستخدم");
    await load();
  }
  return <div className="space-y-3">
    {!isSuper && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">عرض الصلاحيات فقط. التعديل متاح للمشرف الأعلى.</p>}
    <div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو رقم المستخدم" /><Button variant="outline" onClick={() => void load()}>بحث</Button></div>
    {rows.map((user) => <div key={user.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm">
      <div><b>{user.display_name}</b><div className="text-xs text-muted-foreground">ID {user.display_no} · {user.roles.join(", ")}</div></div>
      <div className="flex gap-1">{(["admin", "moderator"] as const).map((role) => {
        const active = user.roles.includes(role);
        return <Button key={role} size="sm" disabled={!isSuper} variant={active ? "destructive" : "outline"} onClick={() => void change(user, role, !active)}>{active ? "إزالة " : "منح "}{role}</Button>;
      })}</div>
    </div>)}
    {rows.length === 0 && <p className="glass rounded-xl p-5 text-center text-sm text-muted-foreground">لا توجد صلاحيات إضافية مسجلة</p>}
  </div>;
}

export function SettingsTab() {
  const [rows, setRows] = useState<{ key: string; value: unknown; updated_at: string; updated_by: string | null }[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  async function load() {
    const { data, error } = await supabase.from("admin_settings").select("key,value,updated_at,updated_by").order("key");
    if (error) toast.error(errMsg(error));
    setRows((data ?? []) as typeof rows);
  }
  useEffect(() => { void load(); }, []);
  useAdminRealtime(["admin_settings"], load);
  async function save() {
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { toast.error("قيمة JSON غير صحيحة"); return; }
    if (!key.trim()) { toast.error("أدخل مفتاح الإعداد"); return; }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("admin_settings").upsert({ key: key.trim(), value: parsed as never, updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم حفظ الإعداد في قاعدة البيانات");
    setKey(""); setValue("{}");
    await load();
  }
  async function remove(k: string) {
    if (!confirm("حذف الإعداد " + k + "؟")) return;
    const { error } = await supabase.from("admin_settings").delete().eq("key", k);
    if (error) { toast.error(errMsg(error)); return; }
    await load();
  }
  return <div className="space-y-3">
    <div className="glass space-y-2 rounded-2xl p-4">
      <b>إعدادات التطبيق المركزية</b>
      <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="مفتاح الإعداد مثل maintenance_mode" dir="ltr" />
      <textarea className="min-h-28 w-full rounded-md border border-input bg-input px-3 py-2 font-mono text-xs" value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" placeholder='{"enabled":false}' />
      <Button className="bg-gold" onClick={() => void save()}>حفظ الإعداد</Button>
    </div>
    {rows.map((row) => <div key={row.key} className="glass flex items-start justify-between gap-2 rounded-xl p-3 text-sm">
      <div className="min-w-0 flex-1"><b dir="ltr">{row.key}</b><pre className="mt-1 overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(row.value, null, 2)}</pre><span className="text-[10px] text-muted-foreground">{fmt(row.updated_at)}</span></div>
      <div className="flex flex-col gap-1"><Button size="sm" variant="outline" onClick={() => { setKey(row.key); setValue(JSON.stringify(row.value, null, 2)); }}>تعديل</Button><Button size="sm" variant="destructive" onClick={() => void remove(row.key)}>حذف</Button></div>
    </div>)}
  </div>;
}

export function AnalyticsTab() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    const { data: result, error } = await supabase.rpc("get_analytics");
    if (error) toast.error(errMsg(error));
    setData((result as Record<string, unknown>) ?? null);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  useAdminRealtime(["profiles", "rooms", "wallets", "gift_transactions", "reports"], load);
  const renderValue = (value: unknown): string => typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value ?? "—");
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><b>تحليلات مباشرة من قاعدة البيانات</b><Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>تحديث</Button></div>
    {!data && <p className="glass rounded-xl p-5 text-center text-sm text-muted-foreground">{loading ? "جارٍ التحميل…" : "لا توجد بيانات تحليلات متاحة"}</p>}
    {data && <div className="grid gap-3 sm:grid-cols-2">{Object.entries(data).map(([key, value]) => <div key={key} className="glass rounded-xl p-4"><b className="capitalize">{key.replaceAll("_", " ")}</b><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{renderValue(value)}</pre></div>)}</div>}
  </div>;
}
