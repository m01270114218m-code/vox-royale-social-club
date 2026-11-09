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
  const [editingId, setEditingId] = useState<string | null>(null);
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
    const payload = { title: form.title.trim(), image_url: form.image_url.trim(), target_url: form.target_url.trim() || null, sort_order: Number(form.sort_order) || 0, updated_at: new Date().toISOString() };
    const { error } = editingId
      ? await supabase.from("banners").update(payload).eq("id", editingId)
      : await supabase.from("banners").insert({ ...payload, is_active: true });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(editingId ? "تم تغيير البانر" : "تم نشر البانر في قاعدة بيانات التطبيق");
    setEditingId(null);
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
    if (editingId === row.id) { setEditingId(null); setForm({ title: "", image_url: "", target_url: "", sort_order: "0" }); }
    await load();
  }
  return <div className="space-y-3">
    <div className="glass space-y-2 rounded-2xl p-4">
      <b>{editingId ? "تغيير بانر الغرف" : "إضافة بانر يظهر داخل قائمة الغرف"}</b>
      <Input placeholder="عنوان البانر" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Input placeholder="رابط الصورة HTTPS" dir="ltr" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
      <Input placeholder="رابط الوجهة (اختياري)" dir="ltr" value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} />
      <Input type="number" placeholder="الترتيب" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
      <div className="flex gap-2"><Button className="bg-gold" onClick={() => void save()}>{editingId ? "حفظ تغيير البانر" : "نشر البانر"}</Button>{editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm({ title: "", image_url: "", target_url: "", sort_order: "0" }); }}>إلغاء</Button>}</div>
    </div>
    {rows.map((row) => <div key={row.id} className="glass flex items-center gap-3 rounded-xl p-3 text-sm">
      <img src={row.image_url} alt="" className="h-14 w-20 rounded-lg object-cover" />
      <div className="min-w-0 flex-1"><b>{row.title}</b><div className="truncate text-xs text-muted-foreground" dir="ltr">{row.image_url}</div><span className="text-xs">{row.is_active ? "نشط" : "متوقف"} · ترتيب {row.sort_order}</span></div>
      <div className="flex flex-col gap-1">
        <Button size="sm" variant="outline" onClick={() => { setEditingId(row.id); setForm({ title: row.title, image_url: row.image_url, target_url: row.target_url || "", sort_order: String(row.sort_order) }); }}>تغيير</Button>
        <Button size="sm" variant="outline" onClick={() => void toggle(row)}>{row.is_active ? "إيقاف" : "تفعيل"}</Button>
        <Button size="sm" variant="destructive" onClick={() => void remove(row)}>حذف</Button>
      </div>
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
  const [authMethods, setAuthMethods] = useState({ email_enabled: true, quick_enabled: true, google_enabled: true, phone_enabled: true });
  const [authBusy, setAuthBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("admin_settings").select("key,value,updated_at,updated_by").order("key");
    if (error) toast.error(errMsg(error));
    setRows((data ?? []) as typeof rows);
    const authRow = (data ?? []).find((r) => r.key === "auth_methods");
    if (authRow) {
      const v = (authRow.value ?? {}) as Record<string, unknown>;
      setAuthMethods({
        email_enabled: v.email_enabled !== false,
        quick_enabled: v.quick_enabled !== false,
        google_enabled: v.google_enabled !== false,
        phone_enabled: v.phone_enabled !== false,
      });
    }
  }

  useEffect(() => { void load(); }, []);
  useAdminRealtime(["admin_settings"], load);

  async function saveAuthMethods(next: typeof authMethods) {
    setAuthBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("admin_settings").upsert({
      key: "auth_methods",
      value: next as never,
      updated_at: new Date().toISOString(),
      updated_by: auth.user?.id ?? null,
    });
    setAuthBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    setAuthMethods(next);
    toast.success("تم تحديث أزرار تسجيل الدخول");
    await load();
  }

  async function save() {
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { toast.error("قيمة JSON غير صحيحة"); return; }
    if (!key.trim()) { toast.error("أدخل مفتاح الإعداد"); return; }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("admin_settings").upsert({ key: key.trim(), value: parsed as never, updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("تم حفظ الإعداد في قاعدة البيانات");
    setKey(""); setValue("{}"); await load();
  }

  async function remove(k: string) {
    if (!confirm("حذف الإعداد " + k + "؟")) return;
    const { error } = await supabase.from("admin_settings").delete().eq("key", k);
    if (error) { toast.error(errMsg(error)); return; }
    await load();
  }

  const authOptions = [
    { key: "email_enabled" as const, title: "البريد الإلكتروني", description: "زر البريد + كلمة المرور + إنشاء الحساب" },
    { key: "google_enabled" as const, title: "Google", description: "زر الدخول عبر حساب Google الحقيقي" },
    { key: "phone_enabled" as const, title: "رقم الهاتف", description: "OTP عبر SMS وتسجيل الرقم في Supabase Auth" },
    { key: "quick_enabled" as const, title: "الدخول السريع", description: "حساب واحد مرتبط بهذا الجهاز" },
  ];

  return <div className="space-y-4">
    <div className="glass rounded-2xl border border-gold/20 p-4">
      <b className="text-lg">أزرار تسجيل الدخول</b>
      <p className="mt-1 text-xs text-muted-foreground">إخفاء أو إظهار كل طريقة من واجهة تسجيل الدخول بدون تعديل الكود.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {authOptions.map((option) => (
          <div key={option.key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/30 p-3">
            <div><b className="text-sm">{option.title}</b><p className="text-[11px] text-muted-foreground">{option.description}</p></div>
            <button type="button" disabled={authBusy} onClick={() => void saveAuthMethods({ ...authMethods, [option.key]: !authMethods[option.key] })} className={`relative h-7 w-12 rounded-full transition ${authMethods[option.key] ? "bg-gold" : "bg-muted"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${authMethods[option.key] ? "right-1" : "left-1"}`} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-300">سياسة الجهاز: بعد ربط حساب بالجهاز، لا يمكن لحساب آخر الاستيلاء على نفس الجهاز عبر تسجيل الدخول السريع أو التسجيل الجديد.</div>
    </div>

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

export function AppBuilderTab() {
  const defaults: Record<string, string> = {
    "ui.branding": JSON.stringify({app_name:"صدي شات",logo_url:"",logo_path:""}, null, 2),
    "app_branding": JSON.stringify({app_name:"صدي شات",logo_path:"",logo_url:""}, null, 2),
    "home_banner": JSON.stringify({title:"",image_path:"",enabled:true}, null, 2),
    "auth_methods": JSON.stringify({email_enabled:true,quick_enabled:true,google_enabled:true,phone_enabled:true}, null, 2),
    "ui.bottom_nav": JSON.stringify({home_label:"الغرف",explore_label:"اللحظات",room_label:"غرفتي",messages_label:"الرسائل",profile_label:"أنا",home_icon:"",explore_icon:"",room_icon:"",messages_icon:"",profile_icon:""}, null, 2),
    "ui.mic": JSON.stringify({mic_style:"neon",show_mic_effect:true,mic_asset_key:"",muted_asset_key:"",effect_asset_key:""}, null, 2),
    "ui.buttons": JSON.stringify({primary_asset_url:"",secondary_asset_url:"",gift_asset_url:"",send_asset_url:""}, null, 2),
    "ui.routes": JSON.stringify({home_title:"الرئيسية",room_title:"الغرفة",store_title:"المتجر",vip_title:"VIP",profile_title:"الملف الشخصي"}, null, 2),
    "features": JSON.stringify({gifts:true,store:true,vip:true,wallet:true,rooms:true,moments:true,messages:true}, null, 2),
    "app_update_policy": JSON.stringify({enabled:false,min_version:"2.0.0",blocked_versions:[],latest_version:"2.0.0",download_url:"",message:"هذا الإصدار قديم. حدّث صدى شات إلى الإصدار 2 للمتابعة."}, null, 2),
  };
  const [rows,setRows]=useState<Record<string,string>>(defaults);
  const [active,setActive]=useState("ui.branding");
  const [loading,setLoading]=useState(false);
  async function load(){
    const {data,error}=await supabase.from("admin_settings").select("key,value").in("key",Object.keys(defaults));
    if(error){toast.error(errMsg(error));return;}
    const next={...defaults};
    for(const r of data??[]) next[r.key]=JSON.stringify(r.value,null,2);
    setRows(next);
  }
  useEffect(()=>{void load();},[]);
  useAdminRealtime(["admin_settings"],load);
  async function save(key:string){
    let parsed:unknown; try{parsed=JSON.parse(rows[key]);}catch{toast.error("JSON غير صحيح");return;}
    setLoading(true);
    const {data:auth}=await supabase.auth.getUser();
    const {error}=await supabase.from("admin_settings").upsert({key,value:parsed as never,updated_at:new Date().toISOString(),updated_by:auth.user?.id??null});
    setLoading(false); if(error){toast.error(errMsg(error));return;} toast.success("تم حفظ التعديل وسيظهر للتطبيق عند تحديث الإعدادات");
  }
  const labels:Record<string,string>={"ui.branding":"هوية التطبيق والرئيسية","app_branding":"اسم التطبيق وشعاره","home_banner":"بنر شاشة الدخول","auth_methods":"طرق تسجيل الدخول","ui.bottom_nav":"الشريط السفلي والأيقونات","ui.mic":"شكل الميك المفتوح والمغلق","ui.buttons":"أصول الأزرار","ui.routes":"عناوين وواجهات الصفحات","features":"تشغيل وإيقاف الخدمات","app_update_policy":"قفل الإصدارات وطلب التحديث"};
  return <div className="space-y-3">
    <div className="glass rounded-2xl p-4"><b>مركز تطوير التطبيق</b><p className="mt-1 text-xs text-muted-foreground">تحكم مركزي في الأسماء والروابط والأصول وشكل الميك والأزرار والشريط السفلي والخدمات. استخدم روابط HTTPS أو روابط Supabase Storage.</p></div>
    <div className="flex gap-2 overflow-x-auto">{Object.keys(defaults).map(k=><button key={k} onClick={()=>setActive(k)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs ${active===k?"bg-gold":"bg-secondary"}`}>{labels[k]}</button>)}</div>
    <div className="glass space-y-3 rounded-2xl p-4"><b>{labels[active]}</b><textarea className="min-h-72 w-full rounded-md border border-input bg-input p-3 font-mono text-xs" dir="ltr" value={rows[active]??defaults[active]} onChange={e=>setRows({...rows,[active]:e.target.value})}/><Button className="bg-gold" disabled={loading} onClick={()=>void save(active)}>حفظ وتفعيل الإعداد</Button></div>
  </div>;
}
