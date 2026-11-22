import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "مركز الدعم — صدى شات" },
      { name: "description", content: "أرسل تذكرة دعم وتابع بلاغاتك وردود الإدارة." },
      { property: "og:title", content: "مركز الدعم — صدى شات" },
      { property: "og:description", content: "الدعم والبلاغات في صدى شات." },
    ],
  }),
  component: () => (
    <AppShell>
      <Help />
    </AppShell>
  ),
});

const STATUS: Record<string, string> = { open: "مفتوحة", reviewing: "قيد المراجعة", resolved: "تم الحل", rejected: "مرفوضة" };
type R = { id: string; category: string; details: string; status: string; admin_reply: string | null; created_at: string; target_type: string };

function Help() {
  const { user } = useAuth();
  const [list, setList] = useState<R[]>([]);
  const [cat, setCat] = useState("مشكلة تقنية");
  const [details, setDetails] = useState("");
  async function load() {
    const { data } = await supabase.from("reports").select("*").eq("reporter_id", user!.id).order("created_at", { ascending: false });
    setList((data as R[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function send() {
    const { error } = await supabase.rpc("submit_report", { _type: "support", _target: user!.id, _category: cat, _details: details.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("أُرسلت التذكرة");
    setDetails("");
    load();
  }
  return (
    <div>
      <PageHeader title="مركز الدعم" back />
      <div className="glass card-3d mx-4 space-y-2 rounded-3xl p-4">
        <div className="flex flex-wrap gap-2">
          {["مشكلة تقنية", "الشحن والمحفظة", "حساب", "اقتراح"].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-sm ${cat === c ? "bg-gold" : "bg-secondary"}`}>{c}</button>
          ))}
        </div>
        <Input placeholder="اشرح مشكلتك" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
        <Button className="w-full" disabled={details.trim().length < 5} onClick={send}>إرسال</Button>
      </div>
      <h2 className="px-4 pb-2 pt-4 text-sm font-bold text-muted-foreground">تذاكري وبلاغاتي</h2>
      {list.length === 0 && <p className="px-4 text-center text-sm text-muted-foreground">لا توجد تذاكر.</p>}
      <div className="space-y-2 px-4">
        {list.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-3 text-sm">
            <div className="flex justify-between"><b>{r.category}</b><span className="text-primary">{STATUS[r.status] ?? r.status}</span></div>
            <p className="text-muted-foreground">{r.details}</p>
            {r.admin_reply && <p className="mt-1 rounded-xl bg-secondary/60 p-2">رد الإدارة: {r.admin_reply}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
