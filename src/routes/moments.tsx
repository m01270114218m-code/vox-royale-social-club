import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, ImagePlus, Send, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar, MediaImage } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { uploadImage } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { errMsg, flagOf } from "@/lib/vox";

export const Route = createFileRoute("/moments")({
  head: () => ({
    meta: [
      { title: "اللحظات — VOX ROYALE" },
      { name: "description", content: "شارك لحظاتك وصورك وتفاعل مع منشورات أصدقائك." },
      { property: "og:title", content: "اللحظات — VOX ROYALE" },
      { property: "og:description", content: "شارك لحظاتك وتفاعل مع أصدقائك." },
    ],
  }),
  component: () => (
    <AppShell>
      <Moments />
    </AppShell>
  ),
});

type Post = {
  id: string; user_id: string; body: string; image_url: string | null; like_count: number; comment_count: number; created_at: string;
  profiles: { display_name: string; avatar_url: string | null; country: string | null; level: number; vip_level: number } | null;
};
type Comment = { id: string; user_id: string; body: string; created_at: string; profiles: { display_name: string } | null };

function Moments() {
  const { user } = useAuth();
  const uid = user!.id;
  const [tab, setTab] = useState<"all" | "following">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", uid);
    const fset = new Set((f ?? []).map((x) => x.following_id));
    setFollowing(fset);
    let q = supabase.from("posts").select("*, profiles(display_name,avatar_url,country,level,vip_level)").order("created_at", { ascending: false }).limit(50);
    if (tab === "following") q = q.in("user_id", [...fset, uid]);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setPosts((data ?? []) as Post[]);
    const ids = (data ?? []).map((p) => p.id);
    if (ids.length) {
      const { data: l } = await supabase.from("post_likes").select("post_id").eq("user_id", uid).in("post_id", ids);
      setLiked(new Set((l ?? []).map((x) => x.post_id)));
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function publish() {
    if (!body.trim() && !file) return;
    setBusy(true);
    try {
      const image_url = file ? await uploadImage(file, uid) : null;
      const { error } = await supabase.from("posts").insert({ user_id: uid, body: body.trim().slice(0, 1000), image_url });
      if (error) throw error;
      setBody("");
      setFile(null);
      toast.success("تم النشر");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(p: Post) {
    const isLiked = liked.has(p.id);
    const next = new Set(liked);
    isLiked ? next.delete(p.id) : next.add(p.id);
    setLiked(next);
    setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, like_count: x.like_count + (isLiked ? -1 : 1) } : x)));
    const { error } = isLiked
      ? await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", uid)
      : await supabase.from("post_likes").insert({ post_id: p.id, user_id: uid });
    if (error) toast.error(error.message);
  }

  async function follow(id: string) {
    const { error } = await supabase.from("follows").insert({ follower_id: uid, following_id: id });
    if (error) return toast.error(error.message);
    setFollowing((s) => new Set(s).add(id));
  }

  async function remove(id: string) {
    if (!confirm("حذف المنشور؟")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPosts((ps) => ps.filter((p) => p.id !== id));
  }

  async function report(id: string) {
    const { error } = await supabase.rpc("submit_report", { _type: "post", _target: id, _category: "محتوى غير لائق", _details: "" });
    if (error) toast.error(errMsg(error));
    else toast.success("تم إرسال البلاغ للإدارة");
  }

  return (
    <div>
      <PageHeader title="اللحظات" />
      <div className="mb-3 flex gap-2 px-4">
        {(["all", "following"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-gold" : "glass text-muted-foreground"}`}>
            {t === "all" ? "الحالة" : "أتابعهم"}
          </button>
        ))}
      </div>

      <div className="glass mx-4 mb-4 space-y-2 rounded-3xl p-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="بماذا تفكر؟" className="min-h-16 border-0 bg-transparent" />
        {file && <div className="text-xs text-primary">📷 {file.name} <button onClick={() => setFile(null)} className="text-destructive">✕</button></div>}
        <div className="flex items-center justify-between">
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-sm text-muted-foreground"><ImagePlus className="h-5 w-5" /> صورة</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button size="sm" disabled={busy || (!body.trim() && !file)} onClick={publish} className="bg-gold font-bold">نشر</Button>
        </div>
      </div>

      {posts.length === 0 && <div className="glass mx-4 rounded-3xl p-10 text-center text-muted-foreground">لا توجد منشورات بعد</div>}
      <div className="space-y-3 px-4">
        {posts.map((p) => (
          <article key={p.id} className="glass rounded-3xl p-4">
            <div className="flex items-center gap-3">
              <Link to="/u/$id" params={{ id: p.user_id }}><UserAvatar src={p.profiles?.avatar_url} name={p.profiles?.display_name} size={44} /></Link>
              <div className="min-w-0 flex-1">
                <Link to="/u/$id" params={{ id: p.user_id }} className="block truncate font-bold">{p.profiles?.display_name}</Link>
                <div className="flex gap-1 text-[10px]">
                  <span className="rounded-full bg-secondary px-2">Lv.{p.profiles?.level}</span>
                  {!!p.profiles?.vip_level && <span className="bg-gold rounded-full px-2">VIP{p.profiles.vip_level}</span>}
                </div>
              </div>
              {p.user_id !== uid && !following.has(p.user_id) && <Button size="sm" variant="outline" onClick={() => follow(p.user_id)}>+ متابعة</Button>}
            </div>
            {p.body && <p className="mt-3 whitespace-pre-wrap leading-relaxed">{p.body}</p>}
            {p.image_url && <MediaImage src={p.image_url} className="mt-3 max-h-96 w-full rounded-2xl object-cover" />}
            <div className="mt-2 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("ar-EG")} · {flagOf(p.profiles?.country)}</div>
            <div className="mt-3 flex items-center gap-5 text-sm">
              <button onClick={() => toggleLike(p)} className={`flex items-center gap-1 ${liked.has(p.id) ? "text-destructive" : ""}`}>
                <Heart className={`h-5 w-5 ${liked.has(p.id) ? "fill-current" : ""}`} />{p.like_count}
              </button>
              <button onClick={() => setOpenComments(openComments === p.id ? null : p.id)} className="flex items-center gap-1"><MessageCircle className="h-5 w-5" />{p.comment_count}</button>
              <span className="flex-1" />
              {p.user_id === uid ? (
                <button onClick={() => remove(p.id)} aria-label="حذف"><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
              ) : (
                <button onClick={() => report(p.id)} aria-label="إبلاغ"><Flag className="h-4 w-4 text-muted-foreground" /></button>
              )}
            </div>
            {openComments === p.id && <Comments postId={p.id} onAdded={() => setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, comment_count: x.comment_count + 1 } : x)))} />}
          </article>
        ))}
      </div>
    </div>
  );
}

function Comments({ postId, onAdded }: { postId: string; onAdded: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  async function load() {
    const { data } = await supabase.from("post_comments").select("id,user_id,body,created_at,profiles(display_name)").eq("post_id", postId).order("created_at").limit(100);
    setItems((data ?? []) as Comment[]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user!.id, body: text.trim().slice(0, 300) });
    if (error) return toast.error(error.message);
    setText("");
    onAdded();
    load();
  }
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {items.map((c) => (
        <div key={c.id} className="text-sm"><span className="font-bold text-primary">{c.profiles?.display_name}: </span>{c.body}</div>
      ))}
      <form onSubmit={add} className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="اكتب تعليقاً…" />
        <Button type="submit" size="icon" className="bg-gold"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
