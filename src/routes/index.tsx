import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Users, Lock, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CATEGORIES, COUNTRIES, SEAT_OPTIONS, catName, errMsg, flagOf } from "@/lib/vox";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الغرف الصوتية — VOX ROYALE" },
      { name: "description", content: "اكتشف الغرف الصوتية الشائعة والجديدة حسب الدولة والتصنيف." },
      { property: "og:title", content: "الغرف الصوتية — VOX ROYALE" },
      { property: "og:description", content: "اكتشف الغرف الصوتية الشائعة والجديدة." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { create?: number } => (s["create"] ? { create: 1 } : {}),
  component: () => (
    <AppShell>
      <Home />
    </AppShell>
  ),
});

type Room = { id: string; room_no: number; name: string; description: string | null; category: string; country: string; member_count: number; is_private: boolean; seat_count: number; created_at: string };

function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tab, setTab] = useState<"hot" | "new">("hot");
  const [country, setCountry] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    const { data, error } = await supabase.from("rooms").select("*").limit(100);
    if (error) toast.error(error.message);
    else setRooms(data as Room[]);
  }
  useEffect(() => {
    load();
  }, []);

  const list = useMemo(() => {
    let r = rooms.filter((x) => (!country || x.country === country) && (!cat || x.category === cat));
    if (q.trim()) r = r.filter((x) => x.name.includes(q.trim()) || String(x.room_no) === q.trim());
    return [...r].sort((a, b) => (tab === "hot" ? b.member_count - a.member_count : +new Date(b.created_at) - +new Date(a.created_at)));
  }, [rooms, tab, country, cat, q]);

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-gold text-3xl">VOX ROYALE</h1>
        <div className="flex items-center gap-2">
          <Link to="/notifications" aria-label="الإشعارات" className="glass rounded-full p-2"><Bell className="h-5 w-5" /></Link>
          <CreateRoom />
        </div>
      </header>
      <div className="relative mb-4">
        <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
        <Input className="pr-10" placeholder="ابحث باسم الغرفة أو رقمها" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-3 flex gap-2">
        {(["hot", "new"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-gold" : "glass text-muted-foreground"}`}>
            {t === "hot" ? "🔥 الشائعة" : "✨ الجديدة"}
          </button>
        ))}
      </div>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-2">
        <Chip active={!country} onClick={() => setCountry(null)}>🌍 الكل</Chip>
        {COUNTRIES.map((c) => (
          <Chip key={c.code} active={country === c.code} onClick={() => setCountry(c.code)}>{c.flag} {c.name}</Chip>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        <Chip active={!cat} onClick={() => setCat(null)}>كل التصنيفات</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">لا توجد غرف بعد — أنشئ أول غرفة!</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((r) => (
            <Link key={r.id} to="/room/$id" params={{ id: r.id }} className="glass group relative aspect-[3/4] overflow-hidden rounded-3xl p-3 transition hover:shadow-gold">
              <div className="absolute inset-0 bg-royal opacity-80" />
              <div className="relative flex h-full flex-col justify-between">
                <span className="w-fit rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{catName(r.category)}</span>
                <div className="font-display text-6xl text-center text-gold opacity-80">{r.name.slice(0, 1)}</div>
                <div>
                  <div className="flex items-center gap-1 font-bold">
                    {flagOf(r.country)} <span className="truncate">{r.name}</span> {r.is_private && <Lock className="h-3 w-3" />}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>#{r.room_no}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.member_count}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full px-3 py-1 text-sm ${active ? "bg-secondary text-primary ring-1 ring-primary" : "glass text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function CreateRoom() {
  const nav = useNavigate();
  const { create } = Route.useSearch();
  const [open, setOpen] = useState(!!create);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("chat");
  const [country, setCountry] = useState("EG");
  const [seats, setSeats] = useState(8);
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_room", { _name: name, _description: desc, _category: category, _country: country, _seat_count: seats, _is_private: priv });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    setOpen(false);
    nav({ to: "/room/$id", params: { id: data as string } });
  }
  const sel = "w-full rounded-md border border-input bg-input px-3 py-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gold rounded-full font-bold shadow-gold"><Plus className="h-4 w-4" /> غرفة</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle className="font-display text-gold">إنشاء غرفة</DialogTitle></DialogHeader>
        <form onSubmit={create} className="space-y-3">
          <Input placeholder="اسم الغرفة" required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="وصف (اختياري)" maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className={sel} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={sel} value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-sm text-muted-foreground">عدد المقاعد</div>
            <div className="flex flex-wrap gap-2">
              {SEAT_OPTIONS.map((n) => (
                <button type="button" key={n} onClick={() => setSeats(n)} className={`h-10 w-12 rounded-xl font-bold ${seats === n ? "bg-gold" : "glass"}`}>{n}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> غرفة خاصة</label>
          <Button type="submit" disabled={busy} className="w-full bg-gold font-bold">إنشاء</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
