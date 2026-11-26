import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "@/components/app/toast";
import { SubHeader } from "@/components/app/AppShell";
import { meAsUser, useProfile } from "@/components/app/profile";
import { setActiveRoom, signOut } from "@/components/app/session";
import { Avatar, Sheet, SpecialId } from "@/components/app/ui";
import { Toggle } from "@/components/app/centers";
import { icons, ui } from '@/components/app/data';
import { Button } from '@/components/ui/button';
import { useCloudState } from '@/components/app/cloud-state';
import { canAdmin } from '@/components/app/control-rules';

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "الإعدادات | صدى شات" }, { name: "description", content: "الخصوصية والإشعارات وإدارة الحساب" }, { property: "og:title", content: "الإعدادات | صدى شات" }, { property: "og:description", content: "ربط الحساب والخصوصية والإشعارات وحذف الحساب" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Settings,
});

function Row({ icon, label, value, onClick, danger, right }: { icon: string; label: string; value?: string; onClick?: () => void; danger?: boolean; right?: React.ReactNode }) {
  const content=<>
      <img src={icon} alt="" className="h-9 w-9 shrink-0 object-contain"/>
      <span className={`flex-1 text-[14px] font-semibold ${danger ? "text-destructive" : "text-navy"}`}>{label}</span>
      {value && <span className="text-[12px] text-muted-foreground">{value}</span>}
      {right ?? <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
    </>;
  const cls='flex min-h-[56px] w-full items-center gap-3 px-1 text-start';
  return onClick?<Button variant="ghost" onClick={onClick} className={`${cls} h-auto whitespace-normal py-3`}>{content}</Button>:<div className={cls}>{content}</div>;
}

const providers = [{ k: "google", n: "Google" }, { k: "facebook", n: "Facebook" }, { k: "phone", n: "رقم الهاتف" }] as const;

function Settings() {
  const p = useProfile();
  const admin = canAdmin(useCloudState().roles);
  const user=meAsUser(p);
  const nav = useNavigate();
  const [sheet, setSheet] = useState<"delete" | "privacy" | "about" | null>(null);
  const [confirm, setConfirm] = useState("");
  const [hideOnline, setHideOnline] = useState(false);
  const logout = () => { setActiveRoom(null); signOut(); void nav({ to: "/login", replace: true }); };
  const del = () => { toast('حذف الحساب الحقيقي غير متاح حاليًا؛ لم يتم حذف بياناتك'); };
  return (
    <div className="pb-8">
      <SubHeader title="الإعدادات" />
      <div className="space-y-3 px-3.5">
        <Link to="/me/edit" className="flex items-center gap-4 border-b border-border py-4"><Avatar img={user.avatar} frame={p.frame} size={54} className="m-2"/><div className="min-w-0 flex-1"><h1 className="user-name text-[17px] font-black text-navy">{user.name}</h1><SpecialId uid={user.uid} sid={user.sid}/></div><ChevronLeft className="h-4 w-4 shrink-0"/></Link>
        <div className="divide-y divide-border border-b border-border pb-3">
          <Row icon={icons.badge} label="الخصوصية" onClick={() => setSheet("privacy")} />
          <Row icon={ui.mail} label="الإشعارات" right={<Toggle label="الإشعارات" on={p.notify} onChange={(v) => { setProfile({ notify: v }); toast(v ? "تم تشغيل الإشعارات" : "تم إيقاف الإشعارات"); }} />} />
          <Row icon={icons.host} label="اللغة" value="العربية" onClick={() => toast("العربية هي اللغة الحالية")} />
        </div>
        <div className="divide-y divide-border border-b border-border pb-3">
          {admin && <Link to="/admin" className="block"><Row icon={icons.bd} label="لوحة التحكم" /></Link>}
          <Row icon={icons.hostAgent} label="الدعم والمساعدة" onClick={() => toast("تواصل مع إدارة التطبيق")} />
          <Row icon={icons.task} label="شروط الاستخدام وسياسة الخصوصية" onClick={() => setSheet("about")} />
          <Row icon={ui.castle} label="عن التطبيق" value="الإصدار 1.0.0" onClick={() => setSheet("about")} />
        </div>
        <div className="divide-y divide-border">
          <Row icon={icons.id} label="تسجيل الخروج" onClick={logout} right={<span />} />
          <Row icon={icons.host} label="حذف حسابي" danger onClick={() => setSheet("delete")} />
        </div>
      </div>

      <Sheet open={sheet === "privacy"} onClose={() => setSheet(null)} title="الخصوصية">
        <div className="px-4">
          <div className="flex items-center justify-between py-3"><span className="text-[14px] font-bold text-navy">إخفاء حالة الاتصال</span><Toggle label="إخفاء حالة الاتصال" on={hideOnline} onChange={setHideOnline} /></div>
          <div className="flex items-center justify-between py-3"><span className="text-[14px] font-bold text-navy">قائمة الحظر</span><span className="text-[12px] text-muted-foreground">فارغة</span></div>
        </div>
      </Sheet>

      <Sheet open={sheet === "about"} onClose={() => setSheet(null)} title="صدى شات">
        <p className="px-4 text-[12.5px] leading-relaxed text-muted-foreground">صدى شات: غرف دردشة صوتية عربية. باستخدامك التطبيق فأنت توافق على الالتزام بقواعد المجتمع وعدم نشر أي محتوى مسيء. الإصدار 1.0.0</p>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={() => { setSheet(null); setConfirm(""); }} title="حذف حسابي">
        <div className="space-y-3 px-4">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">سيتم حذف رصيدك وزيناتك ومتابعاتك وكل بياناتك نهائياً ولا يمكن استرجاعها. اكتب <b className="text-destructive">حذف</b> للتأكيد.</p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="حذف" className="h-11 w-full rounded-xl bg-secondary px-3 text-center text-[15px] text-navy outline-none ring-1 ring-border" />
          <button disabled={confirm.trim() !== "حذف"} onClick={del} className="press h-11 w-full rounded-full bg-destructive text-[14px] font-black text-destructive-foreground disabled:opacity-40">حذف الحساب نهائياً</button>
        </div>
      </Sheet>
    </div>
  );
}
