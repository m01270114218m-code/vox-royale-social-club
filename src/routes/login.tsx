import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/app/session";
import { toast } from "@/components/app/toast";
import { loginMedia, ui } from "@/components/app/data";
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول | صدى شات" }, { name: "description", content: "سجّل دخولك إلى صدى شات وانضم لغرف الدردشة الصوتية" }, { property: "og:title", content: "تسجيل الدخول | صدى شات" }, { property: "og:description", content: "سجّل دخولك إلى صدى شات وانضم لغرف الدردشة الصوتية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Login,
});
function Login() {
 const nav=useNavigate(); const auth=useAuth(); const [busy,setBusy]=useState(false);
 const [email,setEmail]=useState(""); const [code,setCode]=useState(""); const [sent,setSent]=useState(false);
 useEffect(()=>{if(auth?.userId)void nav({to:"/",replace:true});},[auth,nav]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();}catch(e){
   const message=e instanceof Error?e.message:"";
   // User cancellation is a normal action, not an error toast.
   if (/cancelled|canceled|إلغاء|ألغى/i.test(message)) return;
   console.error("[Login] sign-in failed", e);
   toast("تعذّر إرسال أو تأكيد رمز البريد، حاول مرة أخرى");
  }finally{setBusy(false);}};
 const emailSubmit=()=>run(async()=>{
  const normalized=email.trim().toLowerCase();
  if(!normalized) throw new Error("أدخل البريد الإلكتروني");
  if(!sent){
    const {error}=await supabase.auth.signInWithOtp({email:normalized,options:{shouldCreateUser:true}});
    if(error)throw error;
    setSent(true);
    toast("تم إرسال رمز التحقق المكوّن من 6 أرقام إلى بريدك");
  }else{
    const token=code.replace(/\D/g,"").slice(0,6);
    if(token.length!==6)throw new Error("أدخل رمز التحقق المكوّن من 6 أرقام");
    const {error}=await supabase.auth.verifyOtp({email:normalized,token,type:"email"});
    if(error)throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");
  }
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
 <div className="auth-option w-full space-y-3 rounded-3xl login-glass p-4">
  <p className="text-center text-[15px] font-black">تسجيل الدخول</p>
  <p className="text-center text-[11.5px] opacity-70">أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق من 6 أرقام</p>
  <input aria-label="البريد الإلكتروني" type="email" required dir="ltr" autoComplete="email" placeholder="name@email.com" className={field} value={email} onChange={e=>setEmail(e.target.value)} disabled={sent}/>
  {sent&&<input aria-label="رمز التحقق" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required dir="ltr" placeholder="••••••" className={field+" text-center tracking-[0.5em] text-lg font-black"} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/>} 
  <Button type="button" disabled={busy} onClick={()=>void emailSubmit()} className="h-12 w-full rounded-xl text-[14px] font-bold">{busy?"جارٍ...":sent?"تأكيد الرمز":"إرسال رمز التحقق"}</Button>
  {sent&&<Button type="button" variant="ghost" className="w-full text-night-foreground" onClick={()=>{setSent(false);setCode("");}}>تغيير البريد</Button>}
 </div>
 <p className="mt-3 text-center text-[10.5px] leading-relaxed opacity-60">بمتابعتك أنت توافق على شروط الاستخدام وسياسة الخصوصية</p>
 </div></div>;
}
