import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "@/components/app/toast";
import { SubHeader } from "@/components/app/AppShell";
import { avatars } from "@/components/app/data";
import { readImageFile, uploadImageDataUrl } from "@/components/app/imageUpload";
import { MY_UID, setProfile, useProfile } from "@/components/app/profile";
import { Avatar, SpecialId } from "@/components/app/ui";
import { useCloudActions } from '@/components/app/cloud';

export const Route = createFileRoute("/me_/edit")({
  head: () => ({ meta: [{ title: "تعديل الملف الشخصي | صدى شات" }, { name: "description", content: "غيّر اسمك وصورتك ونبذتك ودولتك" }, { property: "og:title", content: "تعديل الملف الشخصي | صدى شات" }, { property: "og:description", content: "غيّر اسمك وصورتك ونبذتك ودولتك" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: EditProfile,
});

const flags = ["🇪🇬", "🇸🇦", "🇦🇪", "🇯🇴", "🇲🇦", "🇮🇶", "🇰🇼", "🇩🇿"];

function EditProfile() {
  const act=useCloudActions();
  const p = useProfile();
  const nav = useNavigate();
  const [f, setF] = useState(p);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const url = await readImageFile(file, 420, 0.84);
      setF((cur) => ({ ...cur, customAvatar: url }));
      toast("تم اختيار الصورة من الجهاز");
    } catch {
      toast("تعذّر قراءة الصورة، اختر ملف صورة صالحاً");
    }
  };
  const save = async () => {
    if (!f.name.trim()) { toast("اكتب اسمك أولاً"); return; }
    try {
      const avatar = f.customAvatar ? await uploadImageDataUrl(f.customAvatar, "profile") : avatars[f.avatar] || "";
      if(!await act('profile',{name:f.name.trim(),bio:f.bio.trim(),avatar}))return;
      setProfile({ name: f.name.trim(), bio: f.bio.trim(), gender: f.gender, flag: f.flag, avatar: f.avatar, customAvatar: f.customAvatar ? avatar : null });
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذّر رفع الصورة");
      return;
    }
    toast("تم حفظ الملف الشخصي");
    void nav({ to: "/me" });
  };
  const pill = (on: boolean) => `press shrink-0 rounded-xl border-2 p-1 ${on ? "border-primary bg-primary/10" : "border-transparent bg-secondary"}`;
  const previewImg = f.customAvatar || avatars[f.avatar]!;
  return (
    <div className="pb-24">
      <SubHeader title="تعديل الملف الشخصي" />
      <div className="space-y-3 px-3.5">
        <div className="flex flex-col items-center py-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="press relative m-3" aria-label="اختيار صورة من الجهاز">
            <Avatar img={previewImg} frame={f.frame} size={88} />
            <span className="absolute -bottom-1 -left-1 z-10 grid h-7 w-7 place-items-center rounded-full gold-bg text-navy shadow-md ring-2 ring-secondary">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          <SpecialId uid={MY_UID} sid={f.sid} className="text-navy" />
        </div>
        <Section t="الصورة الشخصية">
          <div className="mb-2 flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="chip chip-active press">
              <Camera className="h-3.5 w-3.5" />اختيار صورة من الجهاز
            </button>
            {f.customAvatar && (
              <button type="button" onClick={() => setF({ ...f, customAvatar: null })} className="chip press text-destructive">إزالة الصورة</button>
            )}
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">{avatars.map((a, i) => <button key={a} onClick={() => setF({ ...f, avatar: i, customAvatar: null })} className={pill(!f.customAvatar && f.avatar === i)}><img src={a} alt="" className="h-11 w-11 rounded-full object-cover" /></button>)}</div>
        </Section>
        <Section t="الاسم"><textarea aria-label="اسم المستخدم" value={f.name} rows={2} onChange={(e) => setF({ ...f, name: e.target.value })} className="user-name w-full resize-none rounded-xl bg-secondary px-3 py-2 text-[14px] text-navy outline-none" /></Section>
        <Section t="النبذة"><textarea value={f.bio} maxLength={80} rows={2} onChange={(e) => setF({ ...f, bio: e.target.value })} className="w-full resize-none rounded-xl bg-secondary px-3 py-2 text-[13px] text-navy outline-none" /></Section>
        <Section t="الجنس والدولة">
          <div className="flex gap-2">{(["m", "f"] as const).map((g) => <button key={g} onClick={() => setF({ ...f, gender: g })} className={`chip press ${f.gender === g ? "chip-active" : ""}`}>{g === "m" ? "ذكر" : "أنثى"}</button>)}</div>
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">{flags.map((x) => <button key={x} onClick={() => setF({ ...f, flag: x })} className={`${pill(f.flag === x)} px-2 text-[18px]`}>{x}</button>)}</div>
        </Section>
      </div>
      <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 border-t bg-background/95 px-3 py-2.5 backdrop-blur">
        <button onClick={save} className="press w-full rounded-full gold-bg py-2.5 text-[15px] font-black text-navy">حفظ</button>
      </div>
    </div>
  );
}

function Section({ t, children }: { t: string; children: React.ReactNode }) {
  return <div className="surface p-2.5"><p className="mb-1.5 text-[12.5px] font-extrabold text-navy">{t}</p>{children}</div>;
}
