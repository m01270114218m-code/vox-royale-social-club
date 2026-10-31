import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "كلمة مرور جديدة — VOX ROYALE" },
      { name: "description", content: "عيّن كلمة مرور جديدة لحسابك." },
      { property: "og:title", content: "كلمة مرور جديدة — VOX ROYALE" },
      { property: "og:description", content: "عيّن كلمة مرور جديدة لحسابك." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const nav = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("تم تغيير كلمة المرور");
    nav({ to: "/" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={save} className="glass w-full max-w-sm space-y-3 rounded-3xl p-6">
        <h1 className="font-display text-gold text-2xl">كلمة مرور جديدة</h1>
        <Input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" />
        <Button type="submit" className="w-full bg-gold">حفظ</Button>
      </form>
    </div>
  );
}
