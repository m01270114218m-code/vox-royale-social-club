import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Send, CheckCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMsg } from "@/lib/vox";

export const Route = createFileRoute("/chat/$id")({
  head: () => ({
    meta: [
      { title: "محادثة خاصة — صدى شات" },
      { name: "description", content: "محادثة خاصة مباشرة." },
      { property: "og:title", content: "محادثة خاصة — صدى شات" },
      { property: "og:description", content: "محادثة خاصة مباشرة." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Chat />
    </RequireAuth>
  ),
});

type M = { id: string; sender_id: string; body: string; created_at: string; read_at: string | null };

function Chat() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const uid = user!.id;
  const nav = useNavigate();
  const [other, setOther] = useState<{ id: string; display_name: string; avatar_url: string | null } | null>(null);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const loadMsgs = useCallback(async () => {
    const { data, error } = await supabase.from("messages").select("id,sender_id,body,created_at,read_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) { console.warn("[chat] refresh failed:", error.message); return; }
    setMsgs((data ?? []).reverse());
    void supabase.rpc("mark_conv_read", { _conv: id });
  }, [id]);
  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
      if (!c) {
        toast.error("المحادثة غير موجودة");
        return nav({ to: "/messages" });
      }
      const oid = c.user_a === uid ? c.user_b : c.user_a;
      const { data: p } = await supabase.from("profiles").select("id,display_name,avatar_url").eq("id", oid).single();
      setOther(p);
      void loadMsgs();
    })();
    const ch = supabase.channel(`chat-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, () => { void loadMsgs(); })
      .subscribe();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void loadMsgs(); }, 1500);
    const onVisible = () => { if (document.visibilityState === "visible") void loadMsgs(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadMsgs, nav, uid]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const b = text;
    setText("");
    const { error } = await supabase.rpc("send_dm", { _conv: id, _body: b });
    if (error) {
      toast.error(errMsg(error));
      setText(b);
      return;
    }
    void loadMsgs();
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col">
      <header className="glass m-3 flex items-center gap-3 rounded-2xl p-3">
        <button onClick={() => nav({ to: "/messages" })} aria-label="رجوع"><ArrowRight /></button>
        {other && (
          <Link to="/u/$id" params={{ id: other.id }} className="flex items-center gap-2">
            <UserAvatar src={other.avatar_url} name={other.display_name} size={36} />
            <span className="font-bold">{other.display_name}</span>
          </Link>
        )}
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-4">
        {msgs.map((m) => {
          const mine = m.sender_id === uid;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-gold" : "glass"}`}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  {mine && (m.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="glass m-3 flex gap-2 rounded-full p-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="اكتب رسالة…" className="border-0 bg-transparent" />
        <Button type="submit" size="icon" className="rounded-full bg-gold"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
