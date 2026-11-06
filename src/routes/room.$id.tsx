import { giftImage, icons3d, roomBackground } from "@/lib/assets3d";
import { UserAvatar, MediaImage } from "@/components/UserAvatar";
import { IdentityBadges } from "@/components/IdentityBadges";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Lock, Mic, MicOff, Send, Share2, Trash2, Users, Crown, Gift, Settings } from "lucide-react";
import { RoomSettings } from "@/components/RoomSettings";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { catName, errMsg, flagOf } from "@/lib/vox";

export const Route = createFileRoute("/room/$id")({
  head: () => ({
    meta: [
      { title: "غرفة صوتية — VOX ROYALE" },
      { name: "description", content: "انضم إلى الغرفة الصوتية، اجلس على المقاعد وتحدث مباشرة." },
      { property: "og:title", content: "غرفة صوتية — VOX ROYALE" },
      { property: "og:description", content: "انضم إلى الغرفة الصوتية وتحدث مباشرة." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <RoomPage />
    </RequireAuth>
  ),
});

const mountCount: Record<string, number> = {};

type Profile = { id: string; display_name: string; avatar_url: string | null; level: number; vip_level: number; equipped_frame?: string | null };
type Seat = { seat_index: number; user_id: string | null; is_locked: boolean; is_muted: boolean };
type Msg = { id: string; user_id: string; body: string; created_at: string; kind?: string };
type GiftT = { id: string; name: string; emoji: string; price: number; tier: string; asset_key?: string | null; asset_url?: string | null };
type Room = { id: string; room_no: number; owner_id: string; name: string; description: string | null; category: string; country: string; seat_count: number; is_private?: boolean; cover_url?: string | null };

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [isMod, setIsMod] = useState(false);
  const [text, setText] = useState("");
  const [seatMenu, setSeatMenu] = useState<Seat | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [gifts, setGifts] = useState<GiftT[]>([]);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTo, setGiftTo] = useState<string | null>(null);
  const [giftSel, setGiftSel] = useState<GiftT | null>(null);
  const [qty, setQty] = useState(1);
  const [coins, setCoins] = useState(0);
  const [anim, setAnim] = useState<{ key: number; emoji: string } | null>(null);
  const [voiceControls, setVoiceControls] = useState<{ mic_style?: string; show_mic_effect?: boolean; mic_asset_url?: string; muted_asset_url?: string; effect_asset_url?: string }>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
   const uid = user?.id ?? "";
  const isOwner = room?.owner_id === uid;
  const isStaff = isOwner || isMod;

  const ensureProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((x) => x && !profiles[x]);
    if (!missing.length) return;
    const { data } = await supabase.from("profiles").select("id,display_name,avatar_url,level,vip_level,equipped_frame").in("id", missing);
    if (data) setProfiles((p) => ({ ...p, ...Object.fromEntries(data.map((d) => [d.id, d as Profile])) }));
  }, [profiles]);

  const loadSeats = useCallback(async () => {
    const { data } = await supabase.from("room_seats").select("seat_index,user_id,is_locked,is_muted").eq("room_id", id).order("seat_index");
    if (data) setSeats(data);
  }, [id]);
  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("room_members").select("user_id").eq("room_id", id);
    if (data) setMembers(data.map((d) => d.user_id));
  }, [id]);

  useEffect(() => {
    let alive = true;
    mountCount[id] = (mountCount[id] ?? 0) + 1;
    (async () => {
      const { data: r, error } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
      if (error || !r) {
        toast.error("الغرفة غير موجودة");
        return nav({ to: "/" });
      }
      const j = await supabase.rpc("join_room", { _room: id });
      if (j.error) {
        toast.error(errMsg(j.error));
        return nav({ to: "/" });
      }
      if (!alive) return;
      setRoom(r as Room);
      const { data: m } = await supabase.from("room_moderators").select("user_id").eq("room_id", id).eq("user_id", uid);
      setIsMod(!!m?.length);
      loadSeats();
      loadMembers();
      const { data: ms } = await supabase.from("room_messages").select("id,user_id,body,created_at,kind").eq("room_id", id).order("created_at", { ascending: false }).limit(50);
      if (ms) setMsgs(ms.reverse());
    })();
    const ch = supabase
      .channel(`room-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_seats", filter: `room_id=eq.${id}` }, () => loadSeats())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, () => loadMembers())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` }, (p) => setMsgs((x) => [...x.slice(-99), p.new as Msg]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_transactions", filter: `room_id=eq.${id}` }, async (p) => {
        const { data: g } = await supabase.from("gifts").select("name,emoji,asset_key").eq("id", (p.new as { gift_id: string }).gift_id).maybeSingle();
        if (g) {
          let image = giftImage(g.name, g.emoji);
          if (g.asset_key) {
            const { data: asset } = await supabase.from("admin_assets").select("url,metadata").eq("asset_key", g.asset_key).eq("is_active", true).maybeSingle();
            const path = asset?.metadata?.storage_path || asset?.url;
            if (path) {
              const { data: signed } = await supabase.storage.from("admin-assets").createSignedUrl(path, 3600);
              image = signed?.signedUrl || image;
            }
          }
          setAnim({ key: Date.now(), emoji: image });
          setTimeout(() => setAnim(null), 2600);
        }
      })
      .subscribe();
    const loadCatalog = async () => {
      const { data: rows } = await supabase.from("gifts").select("id,name,emoji,price,tier,asset_key").eq("active", true).order("sort");
      const keys = (rows || []).map((g) => g.asset_key).filter((key): key is string => !!key);
      const { data: assets } = keys.length ? await supabase.from("admin_assets").select("asset_key,url,metadata").in("asset_key", keys).eq("is_active", true) : { data: [] };
      const assetMap = new Map<string, string>();
      await Promise.all((assets || []).map(async (asset) => {
        const path = asset.metadata?.storage_path || asset.url;
        if (!path) return;
        const { data: signed } = await supabase.storage.from("admin-assets").createSignedUrl(path, 3600);
        if (signed?.signedUrl) assetMap.set(asset.asset_key, signed.signedUrl);
      }));
      setGifts((rows || []).map((g) => ({ ...g, asset_url: g.asset_key ? assetMap.get(g.asset_key) || null : null })) as GiftT[]);
    };
    void loadCatalog();
    const loadVoiceControls = async () => {
      const { data } = await supabase.from("admin_settings").select("value").eq("key", "voice_controls").maybeSingle();
      const cfg = (data?.value || {}) as { mic_style?: string; show_mic_effect?: boolean; mic_asset_key?: string; muted_asset_key?: string; effect_asset_key?: string };
      const getUrl = async (key?: string) => {
        if (!key) return undefined;
        const { data: asset } = await supabase.from("admin_assets").select("url,metadata").eq("asset_key", key).eq("is_active", true).maybeSingle();
        const path = asset?.metadata?.storage_path || asset?.url;
        if (!path) return undefined;
        const { data: signed } = await supabase.storage.from("admin-assets").createSignedUrl(path, 3600);
        return signed?.signedUrl;
      };
      const [mic_asset_url, muted_asset_url, effect_asset_url] = await Promise.all([getUrl(cfg.mic_asset_key), getUrl(cfg.muted_asset_key), getUrl(cfg.effect_asset_key)]);
      setVoiceControls({ mic_style: cfg.mic_style, show_mic_effect: cfg.show_mic_effect, mic_asset_url, muted_asset_url, effect_asset_url });
    };
    void loadVoiceControls();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
      // Defer leaving so a quick remount (dev double-mount, reconnect) doesn't kick us out.
      mountCount[id] = (mountCount[id] ?? 1) - 1;
      setTimeout(() => {
        if (!mountCount[id]) supabase.rpc("leave_room", { _room: id });
      }, 800);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    ensureProfiles([...members, ...seats.map((s) => s.user_id ?? ""), ...msgs.map((m) => m.user_id)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, seats, msgs]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // If I got banned/kicked, leave.
  useEffect(() => {
    if (room && members.length && !members.includes(uid)) {
      toast.error("تمت إزالتك من الغرفة");
      nav({ to: "/" });
    }
  }, [members, room, uid, nav]);

  const mySeat = seats.find((s) => s.user_id === uid);

  async function call(fn: string, args: Record<string, unknown>) {
    const { error } = await supabase.rpc(fn as never, args as never);
    if (error) toast.error(errMsg(error));
    setSeatMenu(null);
  }

  async function onSeat(s: Seat) {
    if (!s.user_id && !s.is_locked && !isStaff) return call("take_seat", { _room: id, _seat: s.seat_index });
    setSeatMenu(s);
  }

  async function openGifts(target?: string) {
    const { data } = await supabase.from("wallets").select("coins").eq("user_id", uid).maybeSingle();
    setCoins(Number(data?.coins ?? 0));
    const others = members.filter((m) => m !== uid);
    setGiftTo(target ?? seats.find((s) => s.user_id && s.user_id !== uid)?.user_id ?? others[0] ?? null);
    setGiftSel(null);
    setQty(1);
    setSeatMenu(null);
    setGiftOpen(true);
  }
  async function sendGift() {
    if (!giftSel || !giftTo) return;
    const { error } = await supabase.rpc("send_gift", { _room: id, _receiver: giftTo, _gift: giftSel.id, _qty: qty });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setCoins((c) => c - giftSel.price * qty);
    setGiftOpen(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const body = text;
    setText("");
    const { error } = await supabase.rpc("send_room_message", { _room: id, _body: body });
    if (error) {
      toast.error(errMsg(error));
      setText(body);
    }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: room?.name ?? "VOX ROYALE", url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط الغرفة");
    }
  }

  if (!room) return <div className="flex min-h-screen items-center justify-center"><Crown className="h-10 w-10 animate-pulse text-primary" /></div>;
  const cols = room.seat_count <= 4 ? "grid-cols-4" : room.seat_count === 6 || room.seat_count === 9 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className="room-scene mx-auto flex h-dvh max-w-2xl flex-col">
      <MediaImage src={room.cover_url || roomBackground(room.category)} className="room-scenery" />
      <header className="glass m-3 flex items-center gap-3 rounded-2xl p-3">
        <Button variant="ghost" size="icon" onClick={() => nav({ to: "/" })} aria-label="رجوع" title="رجوع"><img src={icons3d.back} alt="" className="h-7 w-7 rotate-180 object-contain" /></Button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{flagOf(room.country)} {room.name}</div>
          <div className="text-xs text-muted-foreground">#{room.room_no} · {catName(room.category)}</div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowMembers(true)} className="gap-1 rounded-full px-2"><img src={icons3d.friends} alt="" className="h-5 w-5 object-contain" />{members.length}</Button>
        <Button variant="ghost" size="icon" onClick={share} aria-label="مشاركة" title="مشاركة"><img src={icons3d.share} alt="" className="h-6 w-6 object-contain" /></Button>
        {isOwner && (
          <Button variant="ghost" size="icon" aria-label="إعدادات الغرفة" title="إعدادات الغرفة" onClick={() => setSettingsOpen(true)}><img src={icons3d.gear} alt="" className="h-6 w-6 object-contain" /></Button>
        )}
        {isOwner && (
          <Button variant="ghost" size="icon" aria-label="حذف الغرفة" title="حذف الغرفة" onClick={async () => { if (confirm("حذف الغرفة نهائياً؟")) { const { error } = await supabase.rpc("delete_room", { _room: id }); if (error) toast.error(errMsg(error)); else nav({ to: "/" }); } }}><img src={icons3d.trash} alt="" className="h-6 w-6 object-contain" /></Button>
        )}
      </header>
      {isOwner && <RoomSettings room={room} uid={uid} open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={(r) => setRoom({ ...room, ...r })} />}

      <div className={`grid ${cols} gap-y-5 px-4 py-4`}>
        {seats.map((s) => {
          const p = s.user_id ? profiles[s.user_id] : null;
          const host = s.user_id === room.owner_id;
          return (
            <Button variant="ghost" key={s.seat_index} aria-label={`المقعد ${s.seat_index + 1}${s.is_locked ? " مقفل" : ""}`} onClick={() => onSeat(s)} className="h-auto min-w-0 flex-col gap-1 p-0 hover:bg-transparent">
              <div className="relative flex h-20 w-20 items-center justify-center">
                {p ? <UserAvatar src={p.avatar_url} name={p.display_name} vip={p.vip_level} size={72} frameKey={p.equipped_frame} /> : <img src={s.is_locked ? icons3d.micLocked : voiceControls.mic_asset_url || (s.seat_index === 0 ? icons3d.micHost : icons3d.mic)} alt="" className="h-20 w-20 object-contain" />}
                {p && <img src={s.is_muted ? voiceControls.muted_asset_url || icons3d.micMuted : voiceControls.mic_asset_url || (host ? icons3d.micHost : icons3d.mic)} alt={s.is_muted ? "مكتوم" : "على المقعد"} className="absolute -bottom-1 -left-1 h-7 w-7 object-contain" style={{ filter: voiceControls.mic_style === "neon" ? "drop-shadow(0 0 7px #22d3ee)" : voiceControls.mic_style === "gold" ? "drop-shadow(0 0 7px #e8bd63)" : undefined }} />}
                {p && voiceControls.show_mic_effect && voiceControls.effect_asset_url && <img src={voiceControls.effect_asset_url} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
              </div>
              <span className="max-w-16 truncate text-xs">{p ? p.display_name : s.seat_index + 1}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4">
        <div className="rounded-xl bg-secondary/60 p-2 text-xs text-primary">📢 مرحباً بك في {room.name}. {room.description}</div>
        {msgs.map((m) => (
          <div key={m.id} className={`w-fit max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${m.kind === "gift" ? "bg-gold font-bold" : "glass"}`}>
            <span className="font-bold text-primary">{profiles[m.user_id]?.display_name ?? "…"}: </span>
            {m.body}
          </div>
        ))}
        <div ref={chatEnd} />
      </div>

      <form onSubmit={send} className="glass m-3 flex items-center gap-2 rounded-full p-2">
        {mySeat && (
          <Button type="button" variant="ghost" size="icon" onClick={() => call("toggle_my_mute", { _room: id })} aria-label="المايك" title="المايك"><img src={mySeat.is_muted ? icons3d.micMuted : icons3d.mic} alt="" className="h-8 w-8 object-contain" /></Button>
        )}
        <Button type="button" variant="ghost" size="icon" onClick={() => openGifts()} aria-label="هدية" title="هدية"><img src={icons3d.giftbox} alt="" className="h-8 w-8 object-contain" /></Button>
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="اكتب رسالة…" className="border-0 bg-transparent" />
        <Button type="submit" size="icon" aria-label="إرسال" title="إرسال" className="rounded-full bg-gold"><img src={icons3d.send} alt="" className="h-7 w-7 object-contain" /></Button>
      </form>

      <Sheet open={!!seatMenu} onOpenChange={(o) => !o && setSeatMenu(null)}>
        <SheetContent side="bottom" dir="rtl" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>المقعد {seatMenu ? seatMenu.seat_index + 1 : ""}</SheetTitle></SheetHeader>
          {seatMenu && (
            <div className="grid gap-2 p-4">
              {!seatMenu.user_id && (!seatMenu.is_locked || isStaff) && <Button onClick={() => call("take_seat", { _room: id, _seat: seatMenu.seat_index })} className="bg-gold">الجلوس هنا</Button>}
              {seatMenu.user_id === uid && <Button variant="outline" onClick={() => call("leave_seat", { _room: id })}>مغادرة المقعد</Button>}
              {isStaff && (
                <>
                  <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: seatMenu.is_locked ? "unlock" : "lock" })}>{seatMenu.is_locked ? "فتح المقعد" : "قفل المقعد"}</Button>
                  {seatMenu.user_id && (
                    <>
                      <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: seatMenu.is_muted ? "unmute" : "mute" })}>{seatMenu.is_muted ? "تشغيل المايك" : "كتم المايك"}</Button>
                      {seatMenu.user_id !== uid && <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: "kick_seat" })}>إنزال من المقعد</Button>}
                      {seatMenu.user_id !== uid && seatMenu.user_id !== room.owner_id && <Button variant="destructive" onClick={() => call("ban_user", { _room: id, _user: seatMenu.user_id })}>حظر من الغرفة</Button>}
                    </>
                  )}
                </>
              )}
               {seatMenu.user_id && seatMenu.user_id !== uid && <Button onClick={() => { if (seatMenu.user_id) openGifts(seatMenu.user_id); }} className="bg-accent text-accent-foreground"><img src={icons3d.giftbox} alt="" className="h-6 w-6 object-contain" /> إرسال هدية</Button>}
               {seatMenu.user_id && <IdentityBadges level={profiles[seatMenu.user_id]?.level} vip={profiles[seatMenu.user_id]?.vip_level} />}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {anim && (
        <div key={anim.key} className="gift-pop pointer-events-none fixed inset-0 z-50 flex items-center justify-center"><img src={anim.emoji} alt="" className="h-64 w-64 object-contain" /></div>
      )}

      <Sheet open={giftOpen} onOpenChange={setGiftOpen}>
        <SheetContent side="bottom" dir="rtl" className="max-h-[80vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle className="flex justify-between"><span>الهدايا</span><span className="text-primary">🪙 {coins}</span></SheetTitle></SheetHeader>
          <div className="space-y-3 p-4">
            <select className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" value={giftTo ?? ""} onChange={(e) => setGiftTo(e.target.value)}>
              {members.filter((m) => m !== uid).length === 0 && <option value="">لا يوجد أحد غيرك في الغرفة</option>}
              {members.filter((m) => m !== uid).map((m) => <option key={m} value={m}>إلى: {profiles[m]?.display_name ?? "…"}</option>)}
            </select>
            <div className="grid grid-cols-4 gap-2">
              {gifts.map((g) => (
                <Button variant="ghost" key={g.id} onClick={() => setGiftSel(g)} className={`h-auto flex-col gap-1 rounded-xl p-2 ${giftSel?.id === g.id ? "bg-secondary ring-2 ring-primary" : "glass"}`}>
                  <img src={g.asset_url || giftImage(g.name, g.emoji)} alt={g.name} className="h-16 w-16 object-contain" />
                  <span className="text-xs">{g.name}</span>
                  <span className="text-xs text-primary">🪙{g.price}</span>
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {[1, 10, 99].map((n) => <Button variant="ghost" size="sm" key={n} onClick={() => setQty(n)} className={`rounded-full ${qty === n ? "bg-gold" : "glass"}`}>x{n}</Button>)}
              <Button disabled={!giftSel || !giftTo} onClick={sendGift} className="mr-auto bg-gold font-bold">إرسال {giftSel ? `(${giftSel.price * qty})` : ""}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showMembers} onOpenChange={setShowMembers}>
        <SheetContent side="bottom" dir="rtl" className="max-h-[70vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle>الموجودون ({members.length})</SheetTitle></SheetHeader>
          <div className="space-y-2 p-4">
            {members.map((m) => (
              <div key={m} className="flex items-center justify-between rounded-xl bg-secondary/50 p-2">
                <div className="flex items-center gap-2"><UserAvatar src={profiles[m]?.avatar_url} name={profiles[m]?.display_name} vip={profiles[m]?.vip_level} size={44} frameKey={profiles[m]?.equipped_frame} /><div><span>{profiles[m]?.display_name ?? "…"}</span><IdentityBadges level={profiles[m]?.level} vip={profiles[m]?.vip_level} /></div></div>
                {isStaff && m !== uid && m !== room.owner_id && <Button size="sm" variant="destructive" onClick={() => call("ban_user", { _room: id, _user: m })}>حظر</Button>}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
