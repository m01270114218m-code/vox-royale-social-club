import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Smartphone } from "lucide-react";
import { signIn, useAuth } from "@/components/app/session";
import { toast } from "@/components/app/toast";
import { loginMedia, ui } from "@/components/app/data";
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول | صدى شات" }, { name: "description", content: "سجّل دخولك إلى صدى شات وانضم لغرف الدردشة الصوتية" }, { property: "og:title", content: "تسجيل الدخول | صدى شات" }, { property: "og:description", content: "سجّل دخولك إلى صدى شات وانضم لغرف الدردشة الصوتية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Login,
});
type Mode = "menu" | "email" | "phone";
function Login() {
 const nav=useNavigate(); const auth=useAuth(); const [busy,setBusy]=useState(false);
 const [mode,setMode]=useState<Mode>("menu"); const [signup,setSignup]=useState(false);
 const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
 const [phone,setPhone]=useState(""); const [code,setCode]=useState(""); const [sent,setSent]=useState(false);
 useEffect(()=>{if(auth?.userId)void nav({to:"/",replace:true});},[auth,nav]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();}catch(e){
   const message=e instanceof Error?e.message:"";
   // User cancellation is a normal action, not an error toast.
   if (/cancelled|canceled|إلغاء|ألغى/i.test(message)) return;
   console.error("[Login] sign-in failed", e);
   toast("تعذّر فتح تسجيل الدخول عبر Facebook، حاول مرة أخرى");
  }finally{setBusy(false);}};
 const social=(provider:"facebook")=>run(async()=>{
  if(provider!=="facebook")return;
  await signIn({method:"facebook",at:new Date().toISOString()});
 });
 const emailSubmit=()=>run(async()=>{
  if(signup){const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}}); if(error)throw error; if(!data.session)toast("تم إنشاء الحساب، افتح بريدك لتأكيده");}
  else{const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)throw new Error("البريد أو كلمة السر غير صحيحة");}
 });
 const phoneSubmit=()=>run(async()=>{
  const full=phone.startsWith("+")?phone:`+${phone}`;
  if(!sent){const {error}=await supabase.auth.signInWithOtp({phone:full}); if(error)throw error; setSent(true); toast("تم إرسال رمز التحقق");}
  else{const {error}=await supabase.auth.verifyOtp({phone:full,token:code,type:"sms"}); if(error)throw new Error("رمز غير صحيح");}
 });
 const field="h-12 w-full rounded-xl border border-border bg-secondary/90 px-4 text-[14px] text-navy";
 const opt="auth-option h-12 w-full justify-start gap-3 rounded-xl px-4 text-[14px] font-bold";
 return <div dir="rtl" className="relative mx-auto h-[100dvh] max-w-[440px] overflow-hidden bg-night text-night-foreground">
 <video className="absolute inset-0 h-full w-full object-cover" src={loginMedia.video} poster={loginMedia.poster} autoPlay muted loop playsInline/>
 <div className="login-scrim absolute inset-0"/><div className="relative flex h-full flex-col items-center px-5 pb-5 pt-12">
 <div className="auth-option relative grid h-[92px] w-[92px] place-items-center rounded-full login-glass gold-ring"><img src={ui.castle} alt="" className="h-16 w-16 object-contain"/></div>
 <h1 className="wordmark auth-option mt-4 text-[44px] leading-none" dir="ltr" lang="en">SadaChat</h1>
 <p className="auth-option mt-2 flex items-center gap-2 text-[13px] font-bold tracking-wide opacity-90"><span className="h-px w-7 bg-gold/60"/>صدى شات<span className="h-px w-7 bg-gold/60"/></p>
 <p className="auth-option mt-1.5 text-[11.5px] opacity-70">غرف صوتية، هدايا فاخرة وأصدقاء جدد</p><div className="flex-1"/>
 {mode==="menu"&&<div className="login-glass auth-option w-full space-y-2.5 rounded-3xl p-4"><p className="pb-1 text-center text-[13.5px] font-black">سجّل دخولك للمتابعة</p>
  <Button disabled={busy} onClick={()=>void social("facebook")} className={`facebook-signin ${opt}`} style={{animationDelay:"0ms"}}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current"><path d="M13.5 22v-8h2.75l.42-3h-3.17V9.08c0-.87.24-1.46 1.5-1.46h1.79V4.94c-.31-.04-1.37-.14-2.61-.14-2.58 0-4.35 1.58-4.35 4.48V11H7v3h2.83v8h3.67Z"/></svg><span className="flex-1 text-center">المتابعة باستخدام Facebook</span></Button>
  <Button disabled={busy} variant="secondary" onClick={()=>setMode("email")} className={opt} style={{animationDelay:"80ms"}}><Mail className="h-[18px] w-[18px] text-primary"/><span className="flex-1 text-center">البريد الإلكتروني وكلمة السر</span></Button>
  <Button disabled={busy} variant="secondary" onClick={()=>setMode("phone")} className={opt} style={{animationDelay:"160ms"}}><Smartphone className="h-[18px] w-[18px] text-primary"/><span className="flex-1 text-center">رقم الهاتف</span></Button></div>}
 {mode==="email"&&<form className="auth-option w-full space-y-2.5 rounded-3xl login-glass p-4" onSubmit={e=>{e.preventDefault();void emailSubmit();}}>
  <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/20 p-1">{[{v:false,l:"تسجيل الدخول"},{v:true,l:"إنشاء حساب"}].map(t=><Button key={t.l} type="button" variant={signup===t.v?"default":"ghost"} className="h-9 rounded-lg text-[13px]" onClick={()=>setSignup(t.v)}>{t.l}</Button>)}</div>
  <input aria-label="البريد الإلكتروني" type="email" required dir="ltr" placeholder="name@email.com" className={field} value={email} onChange={e=>setEmail(e.target.value)}/>
  <input aria-label="كلمة السر" type="password" required minLength={6} dir="ltr" placeholder="••••••" className={field} value={password} onChange={e=>setPassword(e.target.value)}/>
  <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-[14px] font-bold">{busy?"جارٍ...":signup?"إنشاء حساب":"دخول"}</Button>
  <Button type="button" variant="ghost" className="w-full text-night-foreground" onClick={()=>setMode("menu")}>رجوع</Button></form>}
 {mode==="phone"&&<form className="auth-option w-full space-y-2.5 rounded-3xl login-glass p-4" onSubmit={e=>{e.preventDefault();void phoneSubmit();}}>
  <input aria-label="رقم الهاتف" type="tel" required dir="ltr" placeholder="+20 1xx xxx xxxx" className={field} value={phone} onChange={e=>setPhone(e.target.value.replace(/[^\d+]/g,""))} disabled={sent}/>
  {sent&&<input aria-label="رمز التحقق" inputMode="numeric" required dir="ltr" placeholder="رمز التحقق" className={field} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/>}
  <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-[14px] font-bold">{busy?"جارٍ...":sent?"تأكيد الرمز":"إرسال رمز التحقق"}</Button>
  <Button type="button" variant="ghost" className="w-full text-night-foreground" onClick={()=>{setMode("menu");setSent(false);}}>رجوع</Button></form>}
 <p className="mt-3 text-center text-[10.5px] leading-relaxed opacity-60">بمتابعتك أنت توافق على شروط الاستخدام وسياسة الخصوصية</p>
 </div></div>;
}
