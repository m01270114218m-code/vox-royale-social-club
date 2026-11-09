import { icons3d, roomBackground } from "@/lib/assets3d";
import { UserAvatar, MediaImage } from "@/components/UserAvatar";
import { IdentityBadges } from "@/components/IdentityBadges";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Lock, Mic, MicOff, Send, Share2, Trash2, Users, Gift, Settings, UserPlus, MessageCircle, DoorOpen, VolumeX, LogOut, Ban, Shield } from "lucide-react";
import { RoomSettings } from "@/components/RoomSettings";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { catName, errMsg, flagOf } from "@/lib/vox";
import { getAdminAssetUrl, isVideoAsset, useMedia } from "@/lib/media";
import { RoomVoice } from "@/components/RoomVoice";
import { AppShell } from "@/components/AppShell";
import { HomeScreen } from "./index";

export const Route = createFileRoute("/room/$id")({
  head: () => ({
    meta: [
      { title: "غرفة صوتية — صدى شات" },
      { name: "description", content: "انضم إلى الغرفة الصوتية، اجلس على المقاعد وتحدث مباشرة." },
      { property: "og:title", content: "غرفة صوتية — صدى شات" },
      { property: "og:description", content: "انضم إلى الغرفة الصوتية وتحدث مباشرة." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <RoomPage />
    </RequireAuth>
  ),
});

const pendingRoomLeaves = new Map<string, ReturnType<typeof setTimeout>>();

type Profile = { id: string; display_name: string; display_no?: number; id_color?: string | null; avatar_url: string | null; level: number; vip_level: number; equipped_frame?: string | null; name_color?: string | null; name_effect?: string | null; name_effect_speed?: number | null; chat_bubble_color?: string | null };
type Badge = { badge_name: string; badge_asset_key?: string | null; badge_color?: string | null; is_equipped?: boolean };
type Seat = { seat_index: number; user_id: string | null; is_locked: boolean; is_muted: boolean };
type Msg = { id: string; user_id: string; body: string; created_at: string; kind?: string };
type GiftT = { id: string; name: string; emoji: string; price: number; tier: string; asset_key?: string | null; asset_url?: string | null };
type Room = { id: string; room_no: number; owner_id: string; name: string; description: string | null; category: string; country: string; seat_count: number; is_private?: boolean; cover_url?: string | null; mic_mode?: "request" | "direct" };

function normalizeSeats(rows: Seat[]): Seat[] {
  const seenUsers = new Set<string>();
  return [...rows]
    .sort((a, b) => a.seat_index - b.seat_index)
    .filter((seat) => {
      if (!seat.user_id) return true;
      if (seenUsers.has(seat.user_id)) return false;
      seenUsers.add(seat.user_id);
      return true;
    });
}

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [badges, setBadges] = useState<Record<string, Badge>>({});
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
  const [anim, setAnim] = useState<{ key: number; emoji: string; name: string } | null>(null);
  const [entryAnim, setEntryAnim] = useState<{ key: number; src: string } | null>(null);
  const [voiceControls, setVoiceControls] = useState<{ mic_style?: string; show_mic_effect?: boolean; mic_asset_url?: string; muted_asset_url?: string; effect_asset_url?: string }>({});
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<string[]>([]);
  const [micRequests, setMicRequests] = useState<{ id: string; user_id: string; created_at: string }[]>([]);
  const [myMicRequest, setMyMicRequest] = useState<{ id: string } | null>(null);
  const [chatMutedUser, setChatMutedUser] = useState(false);
  const [targetIsModerator, setTargetIsModerator] = useState(false);
  const [inviteUserSearch, setInviteUserSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exitPrompt, setExitPrompt] = useState(false);
  const [roomMinimized, setRoomMinimized] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const [following, setFollowing] = useState(false);
  const [cardStats, setCardStats] = useState({ followers: 0, friends: 0, posts: 0, likes: 0 });
  const [cardRoom, setCardRoom] = useState<{ id: string; name: string; room_no: number } | null>(null);
  const roomCoverUrl = useMedia(room?.cover_url);
  function showGiftAnimation(image: string) {
    const token = Date.now() + Math.floor(Math.random() * 1000);
    setAnim({ key: token, emoji: image, name: "" });
    window.setTimeout(() => setAnim((current) => current?.key === token ? null : current), 2600);
  }
  useEffect(() => {
    if (!room) return;
    const onBack = () => {
      if (roomMinimized) setRoomMinimized(false);
      else setExitPrompt(true);
      window.history.pushState({ roomExitGuard: true }, "");
    };
    window.history.pushState({ roomExitGuard: true }, "");
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [room?.id, roomMinimized]);
  const chatEnd = useRef<HTMLDivElement>(null);
   const uid = user?.id ?? "";
  const isOwner = room?.owner_id === uid;
  const isStaff = isOwner || isMod;
  const publicName = (userId: string, fallback = "…") => { const p = profiles[userId]; if (!p) return fallback; const effect = p.name_effect && p.name_effect !== "none" ? `name-effect-${p.name_effect}` : ""; return <span className={effect} style={{ color: p.name_color || undefined, animationDuration: `${p.name_effect_speed || 1800}ms` }}>{p.display_name}</span>; };

  const ensureProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((x) => x && !profiles[x]);
    if (!missing.length) return;
    const [{ data }, { data: badgeRows }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,display_no,id_color,avatar_url,level,vip_level,equipped_frame,name_color,name_effect,name_effect_speed,chat_bubble_color").in("id", missing),
      supabase.from("user_badges").select("user_id,badge_name,badge_asset_key,badge_color,is_equipped").in("user_id", missing).eq("is_equipped", true),
    ]);
    if (data) setProfiles((p) => ({ ...p, ...Object.fromEntries(data.map((d) => [d.id, d as Profile])) }));
    if (badgeRows) setBadges((b) => ({ ...b, ...Object.fromEntries(badgeRows.map((d) => [d.user_id, d as Badge])) }));
  }, [profiles]);

  const loadSeats = useCallback(async () => {
    const { data } = await supabase.from("room_seats").select("seat_index,user_id,is_locked,is_muted").eq("room_id", id).order("seat_index");
    if (data) setSeats(normalizeSeats(data as Seat[]));
  }, [id]);
  async function playEntryFor(userId: string) {
    const { data: profile } = await supabase.from("profiles").select("equipped_entry").eq("id", userId).maybeSingle();
    const key = profile?.equipped_entry;
    if (!key) return;
    const src = await getAdminAssetUrl(key);
    if (!src) return;
    const token = Date.now();
    setEntryAnim({ key: token, src });
    setTimeout(() => setEntryAnim((current) => current?.key === token ? null : current), 3200);
  }

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("room_members").select("user_id").eq("room_id", id);
    if (data) setMembers(data.map((d) => d.user_id));
  }, [id]);

  const loadMicRequests = useCallback(async () => {
    const { data } = await supabase.from("room_mic_requests").select("id,user_id,created_at").eq("room_id", id).eq("status", "pending").order("created_at");
    if (data) {
      setMicRequests(data as { id: string; user_id: string; created_at: string }[]);
      setMyMicRequest((data.find((r) => r.user_id === uid) as { id: string } | undefined) ?? null);
    }
  }, [id, uid]);

  useEffect(() => {
    let alive = true;
    const pendingLeave = pendingRoomLeaves.get(id);
    if (pendingLeave) {
      clearTimeout(pendingLeave);
      pendingRoomLeaves.delete(id);
    }
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
      loadMicRequests();
      const { data: membership } = await supabase.from("room_members").select("joined_at").eq("room_id", id).eq("user_id", uid).maybeSingle();
      const joinedAt = membership?.joined_at;
      const messageQuery = supabase.from("room_messages").select("id,user_id,body,created_at,kind").eq("room_id", id).order("created_at", { ascending: true }).limit(100);
      const { data: ms } = joinedAt ? await messageQuery.gte("created_at", joinedAt) : await messageQuery;
      if (ms) setMsgs(ms as Msg[]);
    })();
    const ch = supabase
      .channel(`room-${id}`)
      .on("broadcast", { event: "chat_message" }, (payload) => {
        const message = payload.payload as Msg & { roomId?: string };
        if (message.roomId !== id || !message.id) return;
        setMsgs((current) => current.some((m) => m.id === message.id) ? current : [...current.slice(-99), message]);
      })
      .on("broadcast", { event: "gift_sent" }, async (payload) => {
        const event = payload.payload as { roomId?: string; giftId?: string; eventId?: string };
        if (event.roomId !== id || !event.giftId) return;
        const { data: g } = await supabase.from("gifts").select("name,emoji,asset_key,asset_url").eq("id", event.giftId).maybeSingle();
        if (!g) return;
        const image = (g.asset_key ? await getAdminAssetUrl(g.asset_key) : null) || (g.asset_url ? await getAdminAssetUrl(g.asset_url) : null);
        if (image) showGiftAnimation(image);
      })
      .on("broadcast", { event: "mic_request_changed" }, () => { void loadMicRequests(); })
      .on("broadcast", { event: "member_changed" }, () => { void loadMembers(); void loadSeats(); })
      .on("broadcast", { event: "seat_state" }, (payload) => {
        const data = payload.payload as { roomId?: string; seat?: Seat | null; userId?: string };
        if (data.roomId !== id) return;
        if (data.seat) {
          setSeats((current) => normalizeSeats(current.some((s) => s.seat_index === data.seat!.seat_index)
            ? current.map((s) => s.seat_index === data.seat!.seat_index ? data.seat! : s)
            : [...current, data.seat!]));
        } else if (data.userId) {
          setSeats((current) => current.map((s) => s.user_id === data.userId ? { ...s, user_id: null, is_muted: false } : s));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_seats", filter: `room_id=eq.${id}` }, (payload) => {
        const next = payload.new as Partial<Seat> & { room_id?: string };
        const prev = payload.old as Partial<Seat> & { room_id?: string };
        const seatIndex = Number(next.seat_index ?? prev.seat_index);
        if (!Number.isInteger(seatIndex)) return;
        setSeats((current) => {
          if (payload.eventType === "DELETE") return current.filter((s) => s.seat_index !== seatIndex);
          const row = { seat_index: seatIndex, user_id: (next.user_id ?? null) as string | null, is_locked: !!next.is_locked, is_muted: !!next.is_muted };
          const exists = current.some((s) => s.seat_index === seatIndex);
          return normalizeSeats(exists ? current.map((s) => s.seat_index === seatIndex ? row : s) : [...current, row]);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_moderators", filter: `room_id=eq.${id}` }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { user_id?: string };
        if (row.user_id === uid) setIsMod(payload.eventType !== "DELETE");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_badges" }, async (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { user_id?: string };
        if (!row.user_id) return;
        const { data: badge } = await supabase.from("user_badges").select("user_id,badge_name,badge_asset_key,badge_color,is_equipped").eq("user_id", row.user_id).eq("is_equipped", true).maybeSingle();
        setBadges((current) => {
          const next = { ...current };
          if (badge) next[row.user_id!] = badge as Badge; else delete next[row.user_id!];
          return next;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, async (payload) => {
        const userId = (payload.new as { user_id: string }).user_id;
        setMembers((current) => current.includes(userId) ? current : [...current, userId]);
        await ensureProfiles([userId]);
        void playEntryFor(userId);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, (payload) => {
        const userId = (payload.old as { user_id: string }).user_id;
        setMembers((current) => current.filter((x) => x !== userId));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_mic_requests", filter: `room_id=eq.${id}` }, (payload) => {
        const row = payload.new as { id?: string; user_id?: string; created_at?: string; status?: string };
        if (payload.eventType === "DELETE" || (row.status && row.status !== "pending")) {
          const idToRemove = row.id || (payload.old as { id?: string }).id;
          if (idToRemove) setMicRequests((current) => current.filter((x) => x.id !== idToRemove));
          if (idToRemove === myMicRequest?.id) setMyMicRequest(null);
          return;
        }
        if (row.id && row.user_id && row.created_at) {
          setMicRequests((current) => current.some((x) => x.id === row.id) ? current : [...current, { id: row.id!, user_id: row.user_id!, created_at: row.created_at! }]);
          if (row.user_id === uid) setMyMicRequest({ id: row.id });
        }
      })
       .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` }, (p) => {
        const message = p.new as Msg;
        setMsgs((current) => current.some((m) => m.id === message.id) ? current : [...current.slice(-99), message]);
      })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${id}` }, (payload) => { setRoom((current) => current ? ({ ...current, ...(payload.new as Partial<Room>) }) : current); })
      .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void Promise.all([loadSeats(), loadMembers(), loadMicRequests()]);
        void supabase.from("room_messages").select("id,user_id,body,created_at,kind").eq("room_id", id).order("created_at", { ascending: false }).limit(50)
           .then(({ data }) => { if (data) setMsgs((current) => {
            const byId = new Map(current.map((m) => [m.id, m]));
            data.forEach((m) => byId.set(m.id, m as Msg));
            return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-100);
          }); });
      }
    });
    roomLive.current = ch;
    const loadCatalog = async () => {
      const { data: rows } = await supabase.from("gifts").select("id,name,emoji,price,tier,asset_key,asset_url").eq("active", true).order("sort");
      const resolved = await Promise.all((rows || []).map(async (g) => ({
        ...g,
        // Always resolve the exact admin-uploaded file from its stable asset_key.
        // Do not fall back to the generic gift box when an uploaded asset exists.
        asset_url: (g.asset_key ? await getAdminAssetUrl(g.asset_key) : null) || (g.asset_url ? await getAdminAssetUrl(g.asset_url) : null),
      })));
      setGifts(resolved as GiftT[]);
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
      roomLive.current = null;
      supabase.removeChannel(ch);
      // Defer leaving so a quick remount/reconnect cannot remove the fresh membership.
      const timer = setTimeout(() => {
        pendingRoomLeaves.delete(id);
        void supabase.rpc("leave_room", { _room: id });
      }, 1000);
      pendingRoomLeaves.set(id, timer);
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
  const handleSpeakingUsers = useCallback((users: string[]) => setSpeakingUsers(users), []);
  const myMicEnabled = !!mySeat && !mySeat.is_muted && !isLeavingRoom;

  const roomLive = useRef<ReturnType<typeof supabase.channel> | null>(null);

  async function syncRoomSeats() {
    const { data, error } = await supabase.from("room_seats")
      .select("seat_index,user_id,is_locked,is_muted")
      .eq("room_id", id)
      .order("seat_index");
    if (error || !data) return;
    const nextSeats = normalizeSeats(data as Seat[]);
    setSeats(nextSeats);
    // Broadcast the complete seat snapshot so a moved user also clears their old mic immediately.
    await Promise.all(nextSeats.map((seat) => roomLive.current?.send({
      type: "broadcast",
      event: "seat_state",
      payload: { roomId: id, seat },
    })));
  }

  const broadcastSeat = useCallback(async (seatIndex: number) => {
    const seat = seats.find((s) => s.seat_index === seatIndex);
    if (!seat) return;
    await roomLive.current?.send({
      type: "broadcast",
      event: "seat_state",
      payload: { roomId: id, seat },
    });
  }, [id, seats]);

  async function call(fn: string, args: Record<string, unknown>) {
    const { error } = await supabase.rpc(fn as never, args as never);
    if (error) {
      toast.error(error.message === "vip_protected" ? "VIP 5+ محمي من الكتم والطرد" : errMsg(error));
      setSeatMenu(null);
      return;
    }
    // Publish a complete authoritative seat snapshot immediately after every mic change.
    // This clears the previous seat when a user moves and prevents stale/vanishing mic UI.
    const seatIndex = typeof args._seat === "number" ? args._seat : undefined;
    if (seatIndex !== undefined || fn === "leave_seat" || fn === "toggle_my_mute" || fn === "take_seat" || fn === "staff_invite_to_mic" || fn === "staff_invite_to_seat") {
      await syncRoomSeats();
    }
    if (["staff_kick_room_user", "staff_kick_user_24h", "ban_user"].includes(fn)) {
      await Promise.all([loadMembers(), syncRoomSeats()]);
    }
    setSeatMenu(null);
  }

  async function openUserCard(target: string) {
    setSeatMenu(seats.find((s) => s.user_id === target) ?? { seat_index: -1, user_id: target, is_locked: false, is_muted: false });
    const [followers, graph, posts, roomResult] = await Promise.all([
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", target),
      supabase.from("follows").select("follower_id,following_id").or(`follower_id.eq.${target},following_id.eq.${target}`),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", target),
      supabase.from("room_members").select("room_id,rooms(id,name,room_no)").eq("user_id", target).maybeSingle(),
    ]);
    const followerIds = new Set((graph.data ?? []).filter((r) => r.following_id === target).map((r) => r.follower_id));
    const followingIds = new Set((graph.data ?? []).filter((r) => r.follower_id === target).map((r) => r.following_id));
    const friendCount = [...followerIds].filter((x) => followingIds.has(x)).length;
    let likes = 0;
    const { data: postRows } = await supabase.from("posts").select("id").eq("user_id", target);
    const postIds = (postRows ?? []).map((x) => x.id);
    if (postIds.length) {
      const { count } = await supabase.from("post_likes").select("id", { count: "exact", head: true }).in("post_id", postIds);
      likes = count ?? 0;
    }
    setCardStats({ followers: followers.count ?? 0, friends: friendCount, posts: posts.count ?? 0, likes });
    const rr = roomResult.data as { rooms?: { id: string; name: string; room_no: number } | null } | null;
    setCardRoom(rr?.rooms ?? null);
  }

  async function onSeat(s: Seat) {
    // The seat the user taps is the seat they must receive. Never substitute
    // another free seat; take_seat validates and moves the user atomically.
    if (!s.user_id && !s.is_locked && !isStaff) {
      const { error } = await supabase.rpc("take_seat", { _room: id, _seat: s.seat_index });
      if (error) {
        toast.error(errMsg(error));
      } else {
        await syncRoomSeats();
        toast.success(`تم الصعود إلى الميك رقم ${s.seat_index + 1}`);
      }
      return;
    }
    if (s.is_locked && !isStaff) {
      toast.error("هذا الميك مقفول من صاحب الغرفة");
      return;
    }
    setSeatMenu(s);
    setChatMutedUser(false);
    setTargetIsModerator(false);
    if (s.user_id) void openUserCard(s.user_id);
    if (isStaff && s.user_id && s.user_id !== uid) {
      const [muteResult, modResult] = await Promise.all([
        supabase.rpc("staff_is_chat_muted", { _room: id, _user: s.user_id }),
        supabase.from("room_moderators").select("user_id").eq("room_id", id).eq("user_id", s.user_id).maybeSingle(),
      ]);
      if (!muteResult.error) setChatMutedUser(!!muteResult.data);
      setTargetIsModerator(!!modResult.data);
    }
  }

  async function decideMicRequest(requestId: string, accept: boolean) {
    const { error } = await supabase.rpc("decide_mic_request", { _request: requestId, _accept: accept });
    if (error) toast.error(errMsg(error));
    else {
      await Promise.all([loadMicRequests(), syncRoomSeats()]);
      await roomLive.current?.send({ type: "broadcast", event: "mic_request_changed", payload: { roomId: id } });
      await roomLive.current?.send({ type: "broadcast", event: "member_changed", payload: { roomId: id } });
      toast.success(accept ? "تمت الموافقة على طلب الميك" : "تم رفض الطلب");
    }
  }

  async function toggleFollow(target?: string) { if (!target || target === uid) return; const { data: existing } = await supabase.from("follows").select("follower_id,following_id").eq("follower_id", uid).eq("following_id", target).maybeSingle(); if (existing) { const { error } = await supabase.from("follows").delete().eq("follower_id", uid).eq("following_id", target); if (error) toast.error(errMsg(error)); else { setFollowing(false); toast.success("تم إلغاء المتابعة"); } } else { const { error } = await supabase.from("follows").insert({ follower_id: uid, following_id: target }); if (error) toast.error(errMsg(error)); else { setFollowing(true); toast.success("تمت المتابعة"); } } }

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
    // The sender renders locally; the room broadcast renders for every other connected member.
    if (giftSel.asset_url) showGiftAnimation(giftSel.asset_url);
    await roomLive.current?.send({ type: "broadcast", event: "gift_sent", payload: { roomId: id, giftId: giftSel.id, eventId: crypto.randomUUID() } });
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
      return;
    }
    const { data: saved } = await supabase.from("room_messages").select("id,user_id,body,created_at,kind").eq("room_id", id).eq("user_id", uid).eq("body", body).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (saved) {
      const message = saved as Msg;
      setMsgs((current) => current.some((m) => m.id === message.id) ? current : [...current.slice(-99), message]);
      await roomLive.current?.send({ type: "broadcast", event: "chat_message", payload: { roomId: id, ...message } });
    }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: room?.name ?? "صدى شات", url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط الغرفة");
    }
  }

  if (!room) return <div className="flex min-h-screen items-center justify-center"><img src={icons3d.micHost} alt="صدى شات" className="h-16 w-16 animate-pulse object-contain" /></div>;
  const cols = room.seat_count <= 4 ? "grid-cols-4" : room.seat_count === 6 || room.seat_count === 9 ? "grid-cols-3" : "grid-cols-4";

  return (
    <><RoomVoice roomId={id} uid={uid} members={members} micEnabled={myMicEnabled && micPermissionGranted} onSpeakingUsers={handleSpeakingUsers} />
    {roomMinimized ? (
      <>
        <AppShell>
          <HomeScreen />
        </AppShell>
        <button type="button" onClick={() => setRoomMinimized(false)} className="fixed bottom-24 right-4 z-[100] flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-background shadow-2xl" aria-label="العودة إلى الغرفة">
          <img src={roomCoverUrl || roomBackground(room.category)} alt="" className="h-full w-full rounded-full object-cover" />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">●</span>
        </button>
      </>
    ) : <div className="room-scene mx-auto flex h-dvh max-w-2xl flex-col">
      <MediaImage src={roomBackground(room.category)} className="room-scenery" />
      <header className="glass m-3 flex items-center gap-3 rounded-2xl p-3">
        <Button variant="ghost" size="icon" onClick={() => setExitPrompt(true)} aria-label="رجوع" title="رجوع"><img src={icons3d.back} alt="" className="h-7 w-7 rotate-180 object-contain" /></Button>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <img src={roomCoverUrl || roomBackground(room.category)} alt={`صورة ${room.name}`} className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-primary/40" />
          <div className="min-w-0"><div className="truncate font-bold">{flagOf(room.country)} {room.name}</div>
          <div className="text-xs text-muted-foreground">#{room.room_no} · {catName(room.category)}</div></div>
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
      {isStaff && micRequests.length > 0 && (
        <div className="mx-3 mb-2 rounded-2xl border border-primary/30 bg-secondary/80 p-3" dir="rtl">
          <div className="mb-2 flex items-center justify-between"><span className="font-bold">طلبات الصعود للميك ({micRequests.length})</span></div>
          <div className="space-y-2">
            {micRequests.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-xl bg-background/60 p-2">
                <UserAvatar src={profiles[r.user_id]?.avatar_url} name={publicName(r.user_id, "مستخدم") } vip={profiles[r.user_id]?.vip_level} size={38} />
                <span className="min-w-0 flex-1 truncate">{publicName(r.user_id, "مستخدم") }</span>
                <Button size="sm" onClick={() => void decideMicRequest(r.id, true)} className="bg-gold">موافقة</Button>
                <Button size="sm" variant="outline" onClick={() => void decideMicRequest(r.id, false)}>رفض</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`grid ${cols} gap-y-5 px-4 py-4`}>
        {seats.map((s) => {
          const p = s.user_id ? profiles[s.user_id] : null;
          const host = s.user_id === room.owner_id;
          return (
            <Button variant="ghost" key={s.seat_index} aria-label={`المقعد ${s.seat_index + 1}${s.is_locked ? " مقفل" : ""}`} onClick={() => onSeat(s)} className="h-auto min-w-0 flex-col gap-1 p-0 hover:bg-transparent">
              <div className={`relative flex h-20 w-20 items-center justify-center ${p && speakingUsers.includes(s.user_id!) ? "speaker-active" : ""}`}>
                {p && speakingUsers.includes(s.user_id!) && <><span className="speaker-ring speaker-ring-one" /><span className="speaker-ring speaker-ring-two" /><span className="speaker-glow" /></>}
                {p ? <UserAvatar src={p.avatar_url} name={p.display_name} vip={p.vip_level} size={72} frameKey={p.equipped_frame} /> : <img src={s.is_locked ? icons3d.micLocked : voiceControls.mic_asset_url || (s.seat_index === 0 ? icons3d.micHost : icons3d.mic)} alt="" className="h-20 w-20 object-contain" />}
                {p && <img src={s.is_muted ? voiceControls.muted_asset_url || icons3d.micMuted : voiceControls.mic_asset_url || (host ? icons3d.micHost : icons3d.mic)} alt={s.is_muted ? "مكتوم" : "على المقعد"} className={`absolute -bottom-1 -left-1 h-7 w-7 object-contain ${!s.is_muted && speakingUsers.includes(s.user_id!) ? "speaker-mic-pulse" : ""}`} style={{ filter: voiceControls.mic_style === "neon" ? "drop-shadow(0 0 7px #22d3ee)" : voiceControls.mic_style === "gold" ? "drop-shadow(0 0 7px #e8bd63)" : undefined }} />}
                {p && voiceControls.show_mic_effect && voiceControls.effect_asset_url && <img src={voiceControls.effect_asset_url} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
              </div>
              <span className={`max-w-24 truncate text-xs font-bold ${p?.name_effect && p.name_effect !== "none" ? `name-effect-${p.name_effect}` : ""}`} style={{ color: p?.name_color || undefined, animationDuration: `${p?.name_effect_speed || 1800}ms` }}>{p ? p.display_name : s.seat_index + 1}</span>{p?.display_no && <span className="text-[10px] font-bold" style={{ color: p.id_color || "#D4AF37" }}>ID {p.display_no}</span>}{p && badges[p.id] && <div className="flex items-center justify-center gap-1 text-[9px] font-bold" style={{ color: badges[p.id]?.badge_color || "#D4AF37" }}>✦ {badges[p.id]?.badge_name}</div>}
            </Button>
          );
        })}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4">
        <div className="rounded-xl bg-secondary/60 p-2 text-xs text-primary">📢 مرحباً بك في {room.name}. {room.description}</div>
        {msgs.map((m) => (
          <div key={m.id} className={`w-fit max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${m.kind === "gift" ? "bg-gold font-bold" : "glass"}`} style={{ backgroundColor: m.kind === "gift" ? undefined : profiles[m.user_id]?.chat_bubble_color || undefined }}>
            <button type="button" className="font-bold" style={{ color: profiles[m.user_id]?.name_color || undefined }} onClick={() => void openUserCard(m.user_id)}>{publicName(m.user_id)}: </button>
            {m.body}
          </div>
        ))}
        <div ref={chatEnd} />
      </div>

      <form onSubmit={send} className="glass m-3 flex items-center gap-2 rounded-full p-2">
        {!mySeat && <Button type="button" variant="ghost" size="icon" onClick={async () => { const { error } = await supabase.rpc("take_any_seat", { _room: id }); if (error) toast.error(errMsg(error)); else { await syncRoomSeats(); toast.success("تم الصعود للميك مباشرة"); } }} aria-label="صعود مباشر للميك" title="صعود مباشر للميك"><Mic className="h-7 w-7" /></Button>}
        {mySeat && (
          <Button type="button" variant="ghost" size="icon" onClick={async () => {
            if (!micPermissionGranted) {
              try {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error("الوصول للميكروفون غير مدعوم على هذا الجهاز");
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((track) => track.stop());
                setMicPermissionGranted(true);
                if (mySeat.is_muted) await call("toggle_my_mute", { _room: id });
              } catch (error) {
                const name = error instanceof DOMException ? error.name : "";
                toast.error(name === "NotAllowedError" || name === "PermissionDeniedError"
                  ? "إذن الميكروفون مرفوض. افتحي إعدادات الهاتف > التطبيقات > صدى شات > الأذونات واسمحي بالميكروفون."
                  : error instanceof Error ? error.message : "تعذر الوصول إلى الميكروفون");
              }
              return;
            }
            setMicPermissionGranted(false);
            if (!mySeat.is_muted) await call("toggle_my_mute", { _room: id });
          }} aria-label="المايك" title="المايك"><img src={mySeat.is_muted || !micPermissionGranted ? icons3d.micMuted : icons3d.mic} alt="" className="h-8 w-8 object-contain" /></Button>
        )}
        <Button type="button" variant="ghost" size="icon" onClick={() => openGifts()} aria-label="هدية" title="هدية"><img src={icons3d.giftbox} alt="" className="h-8 w-8 object-contain" /></Button>
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="اكتب رسالة…" className="border-0 bg-transparent" />
        <Button type="submit" size="icon" aria-label="إرسال" title="إرسال" className="rounded-full bg-gold"><img src={icons3d.send} alt="" className="h-7 w-7 object-contain" /></Button>
      </form>

      <Sheet open={!!seatMenu} onOpenChange={(o) => !o && setSeatMenu(null)}>
        <SheetContent side="bottom" dir="rtl" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>{seatMenu && seatMenu.seat_index >= 0 ? `المقعد ${seatMenu.seat_index + 1}` : "إدارة المستخدم"}</SheetTitle></SheetHeader>
          {seatMenu && (
            <div className="grid gap-2 p-4">
              {!seatMenu.user_id && !seatMenu.is_locked && <Button onClick={async () => { const { error } = await supabase.rpc("take_seat", { _room: id, _seat: seatMenu.seat_index }); if (error) toast.error(errMsg(error)); else { await syncRoomSeats(); setSeatMenu(null); toast.success("تم الصعود للميك مباشرة"); } }} className="bg-gold">الصعود للميك بنفسك</Button>}
              {isStaff && seatMenu.seat_index >= 0 && !seatMenu.user_id && (
                <div className="space-y-2 rounded-xl border border-primary/20 p-3">
                  <div className="font-bold text-sm">دعوة مستخدم محدد إلى المقعد {seatMenu.seat_index + 1}</div>
                  <Input value={inviteUserSearch} onChange={(e) => setInviteUserSearch(e.target.value)} placeholder="ابحث باسم المستخدم أو ID" />
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {members.filter((memberId) => memberId !== uid && memberId !== room?.owner_id && !seats.some((seat) => seat.user_id === memberId))
                      .filter((memberId) => {
                        const p = profiles[memberId];
                        const q = inviteUserSearch.trim().toLowerCase();
                        return !q || (p?.display_name || "").toLowerCase().includes(q) || String(p?.display_no ?? "").includes(q);
                      }).map((memberId) => (
                        <div key={memberId} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 p-2">
                          <span className="min-w-0 truncate text-sm">{profiles[memberId]?.display_name || "مستخدم"} · ID {profiles[memberId]?.display_no ?? "—"}</span>
                          <Button size="sm" onClick={() => call("staff_invite_to_seat", { _room: id, _seat: seatMenu.seat_index, _user: memberId })}>دعوة لهذا المقعد</Button>
                        </div>
                      ))}
                    {members.filter((memberId) => memberId !== uid && memberId !== room?.owner_id && !seats.some((seat) => seat.user_id === memberId)).length === 0 && <p className="text-xs text-muted-foreground">لا يوجد أعضاء متاحون للدعوة حالياً</p>}
                  </div>
                </div>
              )}
              {seatMenu.user_id === uid && <Button variant="outline" onClick={() => call("leave_seat", { _room: id })}>مغادرة المقعد</Button>}
              {isStaff && false && (
                <>
                  {seatMenu.seat_index >= 0 && <>
                    <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: seatMenu.is_locked ? "unlock" : "lock" })}>{seatMenu.is_locked ? "فتح المايك" : "قفل المايك"}</Button>
                    <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: seatMenu.is_muted ? "unmute" : "mute" })}>{seatMenu.is_muted ? "إلغاء الكتم" : "كتم المايك"}</Button>
                    {seatMenu.user_id && seatMenu.user_id !== uid && <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: "kick" })}>إنزال من المايك</Button>}
                  </>}
                  {seatMenu.user_id && (
                    <>
                      {((profiles[seatMenu.user_id]?.vip_level ?? 0) < 5 || isOwner) && <>
                        {seatMenu.user_id !== uid && seatMenu.user_id !== room.owner_id && (isOwner || !targetIsModerator) && (
                        <>
                          <Button variant="outline" onClick={() => call("staff_kick_room_user", { _room: id, _user: seatMenu.user_id })}>طرد من الغرفة</Button>
                          <Button variant="outline" onClick={() => call("staff_kick_user_24h", { _room: id, _user: seatMenu.user_id })}>طرد لمدة 24 ساعة</Button>
                          <Button variant="destructive" onClick={() => call("ban_user", { _room: id, _user: seatMenu.user_id })}>حظر دائم</Button>
                          <Button variant="outline" onClick={() => call("staff_set_chat_mute", { _room: id, _user: seatMenu.user_id, _muted: !chatMutedUser })}>{chatMutedUser ? "إلغاء منع الكتابة" : "منع الكتابة في الشات"}</Button>
                          {isOwner && <Button variant="outline" onClick={() => call("staff_set_room_moderator", { _room: id, _user: seatMenu.user_id, _enabled: !targetIsModerator })}>{targetIsModerator ? "إلغاء تعيين المشرف" : "تعيين مشرف للغرفة"}</Button>}
                        </>
                      )}
                      </>}
                      {(profiles[seatMenu.user_id]?.vip_level ?? 0) >= 5 && !isOwner && <div className="rounded-xl border border-gold/40 bg-gold/10 p-2 text-center text-xs font-bold text-gold">🛡️ VIP {profiles[seatMenu.user_id]?.vip_level} — محمي من الكتم والطرد</div>}
                    </>
                  )}
                </>
              )}
               {seatMenu.user_id && profiles[seatMenu.user_id] && <div className="mx-auto w-full max-w-sm rounded-3xl border border-primary/30 bg-gradient-to-br from-background/95 via-background/90 to-primary/10 p-3 text-right shadow-2xl ring-1 ring-gold/20" dir="rtl">
  <div className="mb-2 flex items-center justify-end"><span className="text-[10px] font-bold text-primary">VOX ROYALE</span></div>
  <div className="flex items-center gap-3">
    <button type="button" onClick={() => nav({ to: "/u/$id", params: { id: seatMenu.user_id! } })} className="shrink-0 rounded-full ring-2 ring-primary/40 shadow-gold"><UserAvatar src={profiles[seatMenu.user_id]?.avatar_url} name={profiles[seatMenu.user_id]?.display_name || "مستخدم"} vip={profiles[seatMenu.user_id]?.vip_level} size={68} frameKey={profiles[seatMenu.user_id]?.equipped_frame} /></button>
    <div className="min-w-0 flex-1">
      <button type="button" onClick={() => nav({ to: "/u/$id", params: { id: seatMenu.user_id! } })} className="max-w-full truncate text-right text-base font-bold" style={{ color: profiles[seatMenu.user_id]?.name_color || undefined }}>{profiles[seatMenu.user_id]?.display_name}</button>
      <div className="mt-0.5 text-xs font-bold" style={{ color: profiles[seatMenu.user_id]?.id_color || "#D4AF37" }}>ID {profiles[seatMenu.user_id]?.display_no}</div>
      {badges[seatMenu.user_id] && <div className="mt-1 truncate text-[10px] font-bold" style={{ color: badges[seatMenu.user_id]?.badge_color || "#D4AF37" }}>✦ {badges[seatMenu.user_id]?.badge_name}</div>}
    </div>
  </div>
  <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-black/15 p-2 text-center text-[10px]"><div><b className="block text-sm">{cardStats.followers}</b>متابعون</div><div><b className="block text-sm">{cardStats.friends}</b>أصدقاء</div><div><b className="block text-sm">{cardStats.posts}</b>منشورات</div><div><b className="block text-sm">{cardStats.likes}</b>معجبون</div></div>
  {cardRoom && cardRoom.id !== id && <Button variant="outline" className="mt-2 w-full text-xs" onClick={() => nav({ to: "/room/$id", params: { id: cardRoom.id } })}><DoorOpen className="h-4 w-4" /> دخول غرفة المستخدم · #{cardRoom.room_no}</Button>}
  <div className="mt-2 grid grid-cols-3 gap-1">
    {seatMenu.user_id !== uid && <Button size="sm" variant="outline" onClick={() => void toggleFollow(seatMenu.user_id!)}><UserPlus className="h-4 w-4" />{following ? "متابَع" : "متابعة"}</Button>}
    {seatMenu.user_id !== uid && <Button size="sm" variant="outline" onClick={() => void openGifts(seatMenu.user_id!)}><Gift className="h-4 w-4" />هدية</Button>}
    {seatMenu.user_id !== uid && <Button size="sm" variant="outline" onClick={async () => { const { data, error } = await supabase.rpc("get_or_create_conversation", { _other: seatMenu.user_id! }); if (error) toast.error(errMsg(error)); else nav({ to: "/chat/$id", params: { id: data as string } }); }}><MessageCircle className="h-4 w-4" />رسالة</Button>}
  </div>
  {isStaff && seatMenu.user_id !== uid && seatMenu.user_id !== room.owner_id && <div className="mt-2 grid grid-cols-4 gap-1 border-t border-primary/10 pt-2">
    <Button size="sm" variant="outline" title="طرد" onClick={() => call("staff_kick_room_user", { _room: id, _user: seatMenu.user_id! })}><LogOut className="h-4 w-4" /></Button>
    <Button size="sm" variant="outline" title="كتم" onClick={() => call("staff_set_chat_mute", { _room: id, _user: seatMenu.user_id!, _muted: !chatMutedUser })}><VolumeX className="h-4 w-4" /></Button>
    <Button size="sm" variant="outline" title="إنزال من المايك" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: "kick" })}><Ban className="h-4 w-4" /></Button>
    {isOwner && <Button size="sm" variant="outline" title={targetIsModerator ? "إزالة الأدمن" : "إضافة أدمن"} onClick={() => call("staff_set_room_moderator", { _room: id, _user: seatMenu.user_id!, _enabled: !targetIsModerator })}><UserPlus className="h-4 w-4" /></Button>}
  </div>}
</div>}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {exitPrompt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-5" dir="rtl">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-primary/30 bg-background p-5 shadow-2xl">
            <div className="text-center text-lg font-bold">ماذا تريد أن تفعل؟</div>
            <Button className="w-full" onClick={() => { setExitPrompt(false); setRoomMinimized(true); }}>تصغير الغرفة</Button>
            <Button variant="destructive" className="w-full" disabled={isLeavingRoom} onClick={async () => {
              setIsLeavingRoom(true);
              setExitPrompt(false);
              // Free the mic seat before removing room membership.
              const { error: seatError } = await supabase.rpc("leave_seat", { _room: id });
              if (seatError) console.warn("[room exit] leave_seat:", seatError.message);
              const { error } = await supabase.rpc("leave_room", { _room: id });
              if (error) {
                setIsLeavingRoom(false);
                toast.error(errMsg(error));
                return;
              }
              nav({ to: "/" });
            }}>إغلاق الغرفة</Button>
            <Button variant="ghost" className="w-full" onClick={() => setExitPrompt(false)}>إلغاء</Button>
          </div>
        </div>
      )}
      {entryAnim && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/35">
          {isVideoAsset(entryAnim.src) ? <video key={entryAnim.key} src={entryAnim.src} autoPlay muted playsInline className="max-h-[78vh] max-w-[92vw] object-contain drop-shadow-2xl" /> : <img src={entryAnim.src} alt="تأثير دخول المستخدم" className="max-h-[78vh] max-w-[92vw] object-contain drop-shadow-2xl" />}
        </div>
      )}

      {anim && (
        <div key={anim.key} role="presentation" className="gift-pop pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/25 px-5">{isVideoAsset(anim.emoji) ? <video key={anim.key} src={anim.emoji} autoPlay muted playsInline className="max-h-[72vh] max-w-[90vw] object-contain drop-shadow-2xl" /> : <img src={anim.emoji} alt="" aria-hidden="true" className="max-h-[72vh] max-w-[90vw] object-contain drop-shadow-2xl" />}</div>
      )}

      <Sheet open={giftOpen} onOpenChange={setGiftOpen}>
        <SheetContent side="bottom" dir="rtl" className="max-h-[80vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle className="flex justify-between"><span>الهدايا</span><span className="text-primary">🪙 {coins}</span></SheetTitle></SheetHeader>
          <div className="space-y-3 p-4">
            <select className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" value={giftTo ?? ""} onChange={(e) => setGiftTo(e.target.value)}>
              {members.filter((m) => m !== uid).length === 0 && <option value="">لا يوجد أحد غيرك في الغرفة</option>}
              {members.filter((m) => m !== uid).map((m) => <option key={m} value={m}>إلى: {publicName(m)}</option>)}
            </select>
            <div className="grid grid-cols-4 gap-2">
              {gifts.map((g) => (
                <Button variant="ghost" key={g.id} onClick={() => setGiftSel(g)} className={`h-auto flex-col gap-1 rounded-xl p-2 ${giftSel?.id === g.id ? "bg-secondary ring-2 ring-primary" : "glass"}`}>
                  {g.asset_url ? (isVideoAsset(g.asset_url) ? <video src={g.asset_url} autoPlay muted loop playsInline className="h-16 w-16 object-contain" /> : <img src={g.asset_url} alt={g.name} className="h-16 w-16 object-contain" />) : <span className="grid h-16 w-16 place-items-center rounded-xl bg-secondary text-muted-foreground"><Gift className="h-7 w-7" /></span>}
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
                <div className="flex items-center gap-2"><UserAvatar src={profiles[m]?.avatar_url} name={publicName(m)} vip={profiles[m]?.vip_level} size={44} frameKey={profiles[m]?.equipped_frame} /><div><span>{publicName(m)}</span><span className="text-[10px] text-muted-foreground">ID {profiles[m]?.display_no ?? "—"}</span></div></div>
                {isStaff && m !== uid && m !== room.owner_id && (
                  <div className="flex flex-wrap justify-end gap-1">
                    {!seats.some((seat) => seat.user_id === m) && <Button size="sm" onClick={async () => {
                      const { error } = await supabase.rpc("staff_invite_to_mic", { _room: id, _user: m });
                      if (error) toast.error(errMsg(error));
                      else { await syncRoomSeats(); toast.success("تمت دعوة المستخدم وصعوده للمايك"); setShowMembers(false); }
                    }}>دعوة للمايك</Button>}
                    <Button size="sm" variant="outline" onClick={() => { setShowMembers(false); void onSeat(seats.find((seat) => seat.user_id === m) || { seat_index: -1, user_id: m, is_locked: false, is_muted: false }); }}>إدارة</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>}
    </>
  );
}

