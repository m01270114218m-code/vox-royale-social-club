import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Power, Mic, MicOff, Smile, LayoutGrid, Mail, Send, Heart, Share2, Plus, Check, Lock, Users, Trash2, Volume2, VolumeX, Pencil, UserPlus, MessageCircle, Gift as GiftIcon, AtSign, Minimize2, X, Music2, Image as ImageIcon } from "lucide-react";
import { toast } from "./toast";
import { Coin } from "./AppShell";
import { images, ui, entries, bubbles, emojis, giftTabs, LUXURY_BANNER_MIN, type GiftTab, type ShopGift, type User } from "./data";
import { readImageFile, uploadImageDataUrl } from "./imageUpload";
import { addStat, findUser, setProfile, setRoomMedia, spendCoins, toggleFollow, useProfile } from "./profile";
import { can, roleLabel, type Role } from "./permissions";
import { LUCKY_BANNER_MIN_X, luckyRtp, pickLucky } from "./lucky";
import { setActiveRoom } from "./session";
import { luckyTier, luxuryTier } from "./banners";
import { ActionList, Avatar, GenderChip, LevelChip, RoleBadge, Sheet, SpecialId, VipChip, Media, UserName, UserBadges } from "./ui";
import { Button } from "@/components/ui/button";
import { readCloud, useCloudState } from "./cloud-state";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCloud, cloudAction } from './cloud';
import { ChatText } from './ChatText';
import { RoomMusic } from './RoomMusic';
import { useAgoraRoom } from './voice';

type Msg = { id: string; kind: "chat" | "sys" | "gift" | "notice" | "lucky"; uid?: string; t: string; gift?: string };
type SeatS = { uid: string | null; locked: boolean; muted: boolean; micEnabled: boolean };
type Sheets = { kind: "user"; uid: string } | { kind: "seat"; i: number } | { kind: "menu" } | { kind: "members" } | { kind: "edit" } | { kind: "gift" } | { kind: "emoji" } | {kind:'music'} | null;
type Banner = { k: number; kind: "luxury" | "lucky"; from: User; to: User; gift: ShopGift; qty: number; room?: string; x?: number };

const QTYS = [1, 10, 66, 99, 520];
let mid = 1;
const nid = () => String(++mid);

export function RoomView({ id, minimized }: { id: string; minimized: boolean }) {
  const {data:cloud}=useCloud();
  const room = cloud?.roomList.find((r) => r.id === id) ?? {
    id, name: "جارٍ تحميل الغرفة…", flag: "", vip: 0, online: 0,
    img: cloud?.profile?.avatar_url || cloud?.profile?.avatar || "", host: cloud?.profile?.avatar_url || cloud?.profile?.avatar || "", hostId: cloud?.profile?.id || "",
    badges: [], tag: "غرفة", notice: "", cloud: true,
  };
  const nav = useNavigate();
  const router = useRouter();
  const profile = useProfile();
  const roomOv = profile.roomMedia[id];
  const live = !!room.cloud;
  const roomCover = live ? room.img : roomOv?.cover || room.img;
  const roomBg = live ? (room.bg || room.img || "") : (roomOv?.bg || images.room);
  const roomControl = live ? cloud?.roomControls?.find((x: { room_id: string; frame_id?: string | null; banned?: boolean }) => x.room_id === room.dbId) : undefined;
  const roomFrameUrl = roomControl?.frame_id ? cloud?.assets?.find((a: { id: string; url?: string }) => a.id === roomControl.frame_id)?.url || "" : "";
  const meU: User = findUser("me", profile) ?? {
    id: "", uid: "", name: "", avatar: "", frame: null, bubble: "none", entry: null, sid: null,
    level: 1, vip: 0, gender: "m", flag: "", bio: "", fans: 0, following: 0, charm: 0, wealth: 0, gifts: [],
  };
  const user = (uid: string): User => findUser(uid, profile) ?? meU ?? {
    id: uid, uid, name: "مستخدم", avatar: "", frame: null, bubble: "none", entry: null, sid: null,
    level: 1, vip: 0, gender: "m", flag: "", bio: "", fans: 0, following: 0, charm: 0, wealth: 0, gifts: [],
  };

  const myRole: Role = room.ownerId === cloud?.profile?.id || room.hostId === "me" ? "owner" : cloud?.roles.includes("admin") ? "admin" : "member";
  // rooms owned by real users have no simulated guests
  const hostHere = room.hostId === "me";
  const cloudMembers=cloud?.profiles.filter(p=>p.id!==cloud.profile?.id&&!p.banned).map(p=>p.id) ?? [];
  // Mic/seat artwork is room-authoritative, never based on the viewer's own inventory.
  const roomOwnerId = room.ownerId || room.hostId;
  const equippedSeat = cloud?.equippedItems.find((i: { user_id: string; catalog_id: string }) =>
    i.user_id === roomOwnerId &&
    cloud.catalog.some(c => c.id === i.catalog_id && c.kind === 'seat' && c.enabled && c.url)
  );
  const seatArt = cloud?.catalog.find(c => c.id === equippedSeat?.catalog_id && c.kind === 'seat' && c.enabled && c.url)?.url
    || cloud?.catalog.find(c => c.kind === 'seat' && c.enabled && c.url)?.url
    || "";

  const [roomName, setRoomName] = useState(live ? room.name : roomOv?.name || room.name);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [present, setPresent] = useState<string[]>([]);
  const [seats, setSeats] = useState<SeatS[]>(() => Array.from({ length: 8 }, (_: unknown, i: number) => ({ uid: i === 0 && hostHere ? room.hostId : null, locked: false, muted: false, micEnabled: false })));
  const [hearts, setHearts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [micOn, setMicOn] = useState(false);
  const [membershipReady, setMembershipReady] = useState(false);
  const [roomMemberIds, setRoomMemberIds] = useState<string[]>([]);
  const [roomSeatsLoaded, setRoomSeatsLoaded] = useState(false);
  const seenChatIds = useRef<Set<string>>(new Set());
  const previousRoomMembers = useRef<Set<string>>(new Set());
  const previousMembersRoomId = useRef<string | null>(null);
  const normalizedOwnMicRoomRef = useRef<string | null>(null);
  const hasLoadedRoomMembers = useRef(false);
  const [follow, setFollow] = useState(false);
  const [tab, setTab] = useState(0);
  const [sheet, setSheet] = useState<Sheets>(null);
  const [exitMenu, setExitMenu] = useState(false);
  const [gTab, setGTab] = useState<GiftTab>("static");
  const [gSel, setGSel] = useState(0);
  const [qty, setQty] = useState(1);
  const [giftSending, setGiftSending] = useState(false);
  const [giftTo, setGiftTo] = useState<string>(room.hostId);
  const [bigGift, setBigGift] = useState<{ k: number; g: ShopGift } | null>(null);
  const [luckyWin, setLuckyWin] = useState<{ k: number; x: number; win: number } | null>(null);
  const cloudState = useCloudState();
  const qc = useQueryClient();
  const [fly, setFly] = useState<{ k: number; img: string; dx: number; dy: number } | null>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [typingUids, setTypingUids] = useState<Set<string>>(() => new Set());
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimers = useRef<Map<string, number>>(new Map());
  const lastTypingBroadcast = useRef(0);
  const [emo, setEmo] = useState<Record<string, { k: number; img: string }>>({});
  const [entry, setEntry] = useState<{ k: number; uid: string } | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: "0", kind: "notice", t: (live ? room.notice : roomOv?.notice || room.notice) || "أهلاً بالجميع في الغرفة." }]);
  const chatRef = useRef<HTMLDivElement>(null);
  const entryQ = useRef<string[]>([]);
  const entryBusy = useRef(false);
  const entryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bannerQ = useRef<Banner[]>([]);
  const bannerBusy = useRef(false);

  useEffect(() => {
    if (!live) return;
    const next: Record<string, Role> = {};
    if (room.ownerId) next[room.ownerId] = "owner";
    for (const row of cloud?.allRoles ?? []) {
      const value = String(row.role);
      if (value === "admin" || value === "moderator" || value === "member") next[row.user_id] = value === "moderator" ? "admin" : value as Role;
    }
    if (cloud?.profile?.id && cloud.roles.includes("admin")) next[cloud.profile.id] = "admin";
    setRoles(next);
  }, [live, room.ownerId, cloud?.allRoles, cloud?.profile?.id, cloud?.roles.join("|")]);

  const roleOf = (uid: string): Role => roles[uid] ?? (uid === room.ownerId || uid === room.hostId || (uid === cloud?.profile?.id && myRole === "owner") ? "owner" : "member");
  const mySeat = seats.findIndex((s) => s.uid === "me");
  const seated = seats.map((s) => s.uid).filter((u): u is string => !!u);
  const push = (m: Omit<Msg, "id">) => setMsgs((a) => [...a.slice(-80), { ...m, id: nid() }]);
  const sys = (t: string, uid?: string) => push({ kind: "sys", t, ...(uid ? { uid } : {}) });
  const showEmoji = (uid: string, img: string) => {
    const k = Date.now() + Math.random();
    setEmo((e) => ({ ...e, [uid]: { k, img } }));
    setTimeout(() => setEmo((e) => { if (e[uid]?.k !== k) return e; const n = { ...e }; delete n[uid]; return n; }), 2600);
  };

  // entry show queue
  const playEntry = () => {
    const next = entryQ.current.shift();
    if (!next) { entryBusy.current = false; setEntry(null); return; }
    entryBusy.current = true;
    setEntry({ k: Date.now(), uid: next });
    clearTimeout(entryTimer.current); entryTimer.current = setTimeout(playEntry, 4500);
  };
  const enqueueEntry = (uid: string) => { entryQ.current.push(uid); if (!entryBusy.current) playEntry(); };

  // gift banner queue (luxury + lucky), shown one after another
  const playBanner = () => {
    const next = bannerQ.current.shift();
    if (!next) { bannerBusy.current = false; setBanner(null); return; }
    bannerBusy.current = true;
    setBanner(next);
    setTimeout(playBanner, next.kind === "lucky" ? ((next.x ?? 0) >= 200 ? 5600 : 4600) : next.gift.p * next.qty >= 100000 ? 5600 : 4600);
  };
  const enqueueBanner = (b: Omit<Banner, "k">) => { bannerQ.current.push({ ...b, k: Date.now() + Math.random() }); if (!bannerBusy.current) playBanner(); };

  useEffect(() => {
    const t0 = setTimeout(() => { sys("دخل الغرفة", "me"); enqueueEntry("me"); }, 500);
    return () => clearTimeout(t0);
  }, []);

  // A single database membership row prevents the same account from appearing twice.
  const roomDbId = room.dbId ?? cloud?.roomList.find((r) => r.id === id)?.dbId;
  useEffect(() => {
    if (live) setRoomName(room.name);
  }, [live, room.name]);
  useEffect(() => {
    if (!live) return;
    const latestNotice = room.notice || "أهلاً بالجميع في الغرفة.";
    setMsgs(current => {
      const index = current.findIndex(message => message.kind === "notice");
      if (index < 0) return [{ id: nid(), kind: "notice", t: latestNotice }, ...current];
      return current.map(message => message.kind === "notice" ? { ...message, t: latestNotice } : message);
    });
  }, [live, room.notice]);
  useEffect(() => {
    if (!live || !roomDbId) {
      setMembershipReady(false);
      return;
    }
    let cancelled = false;
    let acquired = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const join = async () => {
      const { error } = await supabase.rpc('join_room', { p_room_id: roomDbId });
      if (error) {
        if (!cancelled) {
          toast(error.message || 'هذا الحساب موجود بالفعل في الغرفة');
          setActiveRoom(null);
          void nav({ to: '/', replace: true });
        }
        return;
      }
      acquired = true;
      if (cancelled) {
        void supabase.rpc('leave_room', { p_room_id: roomDbId });
        return;
      }
      setMembershipReady(true);
      heartbeat = setInterval(() => {
        void supabase.rpc('heartbeat_room', { p_room_id: roomDbId }).then(({ data: alive, error: beatError }) => {
          if (beatError || !alive) {
            console.warn('[room] membership heartbeat lost:', beatError?.message || 'membership missing');
            setMicOn(false);
            setMembershipReady(false);
            setActiveRoom(null);
            toast('انتهى اتصالك بالغرفة، أعد الدخول للمتابعة');
            void nav({ to: '/', replace: true });
          }
        });
      }, 20000);
    };
    void join();
    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      setMembershipReady(false);
      if (acquired) void supabase.rpc('leave_room', { p_room_id: roomDbId });
    };
  }, [id, roomDbId, live, nav]);

  // Gift recipients come only from the real room_members table.
  useEffect(() => {
    if (!live || !roomDbId || !membershipReady) {
      setRoomMemberIds([]);
      return;
    }
    let cancelled = false;
    const loadMembers = async () => {
      const { data, error } = await (supabase as any).from("room_members").select("user_id, joined_at").eq("room_id", roomDbId).order("joined_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.warn("[room] member list unavailable:", error.message);
        setRoomMemberIds([]);
        return;
      }
      setRoomMemberIds((data ?? []).map((row: { user_id: unknown }) => String(row.user_id)));
    };
    void loadMembers();
    const channel = supabase.channel(`room-members:${roomDbId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomDbId}` }, () => { void loadMembers(); })
      .subscribe();
    const timer = window.setInterval(() => { void loadMembers(); }, 15000);
    return () => { cancelled = true; window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [live, roomDbId, membershipReady]);


  // Typing is ephemeral room activity: broadcast only the user's ID and typing flag,
  // never the text being composed.
  const broadcastTyping = (active: boolean) => {
    const userId = cloud?.profile?.id;
    const channel = typingChannelRef.current;
    if (!live || !membershipReady || !userId || !channel) return;
    const now = Date.now();
    if (active && now - lastTypingBroadcast.current < 650) return;
    lastTypingBroadcast.current = now;
    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: userId, typing: active },
    });
  };

  useEffect(() => {
    if (!live || !roomDbId || !membershipReady || !cloud?.profile?.id) return;
    let cancelled = false;
    const channel = supabase.channel(`room-activity:${roomDbId}`, { config: { private: true } });
    typingChannelRef.current = channel;
    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      const userId = String((payload as { user_id?: unknown })?.user_id ?? "");
      const active = (payload as { typing?: unknown })?.typing === true;
      if (!userId || userId === cloud.profile?.id || !roomMemberIds.includes(userId)) return;
      const existing = typingTimers.current.get(userId);
      if (existing) window.clearTimeout(existing);
      if (active) {
        setTypingUids(current => new Set(current).add(userId));
        typingTimers.current.set(userId, window.setTimeout(() => {
          setTypingUids(current => { const next = new Set(current); next.delete(userId); return next; });
          typingTimers.current.delete(userId);
        }, 2600));
      } else {
        setTypingUids(current => { const next = new Set(current); next.delete(userId); return next; });
        typingTimers.current.delete(userId);
      }
    });
    void supabase.realtime.setAuth().then(() => {
      if (!cancelled) channel.subscribe();
    }).catch(error => console.warn("[room] typing channel auth failed:", error));
    return () => {
      cancelled = true;
      void channel.send({ type: "broadcast", event: "typing", payload: { user_id: cloud.profile?.id, typing: false } });
      typingChannelRef.current = null;
      for (const timer of typingTimers.current.values()) window.clearTimeout(timer);
      typingTimers.current.clear();
      setTypingUids(new Set());
      void supabase.removeChannel(channel);
    };
  }, [live, roomDbId, membershipReady, cloud?.profile?.id, roomMemberIds.join("|")]);

  // Restore chat history and receive every new room message through Supabase Realtime.
  useEffect(() => {
    if (!live || !roomDbId || !membershipReady) return;
    let cancelled = false;
    const addRemoteMessage = (row: { id: string; sender_id: string; body: string | null; message_type: string; deleted_at?: string | null }) => {
      if (!row.id || seenChatIds.current.has(row.id) || row.deleted_at || row.message_type !== "text" || !row.body) return;
      seenChatIds.current.add(row.id);
      const uid = row.sender_id === cloud?.profile?.id ? "me" : row.sender_id;
      push({ kind: "chat", uid, t: row.body });
    };
    void (supabase as any).from("chat_messages").select("id,sender_id,body,message_type,deleted_at,created_at")
      .eq("room_id", roomDbId).is("deleted_at", null).order("created_at", { ascending: true }).limit(100)
      .then(({ data, error }: { data: Array<{ id: string; sender_id: string; body: string | null; message_type: string; deleted_at: string | null; created_at: string }> | null; error: { message: string } | null }) => {
        if (cancelled) return;
        if (error) { console.warn("[room] chat history unavailable:", error.message); return; }
        for (const row of data ?? []) addRemoteMessage(row);
      });
    const channel = supabase.channel(`room-chat:${roomDbId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomDbId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const deletedId = String((payload.old as { id?: unknown })?.id ?? "");
          if (deletedId) {
            seenChatIds.current.delete(deletedId);
            setMsgs(current => current.filter(m => m.kind !== "chat" || m.id !== deletedId));
          }
          return;
        }
        if (payload.eventType === "UPDATE") {
          const row = payload.new as { id: string; sender_id: string; body: string | null; message_type: string; deleted_at?: string | null };
          if (row.deleted_at) {
            seenChatIds.current.delete(row.id);
            setMsgs(current => current.filter(m => m.kind !== "chat" || m.id !== row.id));
          }
          return;
        }
        addRemoteMessage(payload.new as { id: string; sender_id: string; body: string | null; message_type: string; deleted_at?: string | null });
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [live, roomDbId, membershipReady, cloud?.profile?.id]);

  // The room_seats table is authoritative; changes made on one device are reflected on every other device.
  useEffect(() => {
    if (!live || !roomDbId || !membershipReady) { setRoomSeatsLoaded(false); return; }
    let cancelled = false;
    const applySeatRows = (rows: Array<{ seat_number: number; user_id: string | null; seat_status: string; mic_enabled?: boolean }>) => {
      const next: SeatS[] = Array.from({ length: 8 }, () => ({ uid: null, locked: false, muted: false, micEnabled: false }));
      for (const row of rows) {
        if (row.seat_number < 0 || row.seat_number > 7) continue;
        const uid = row.user_id === cloud?.profile?.id ? "me" : row.user_id;
        next[row.seat_number] = {
          uid,
          locked: row.seat_status === "locked",
          muted: row.seat_status === "muted",
          micEnabled: row.seat_status === "occupied" && row.mic_enabled === true,
        };
      }
      setSeats(next);
      setRoomSeatsLoaded(true);
    };
    const loadSeats = async () => {
      const { data, error } = await (supabase as any).from("room_seats").select("seat_number,user_id,seat_status,mic_enabled").eq("room_id", roomDbId).order("seat_number");
      if (cancelled) return;
      if (error) { console.warn("[room] seat state unavailable:", error.message); return; }
      applySeatRows(data ?? []);
      if (normalizedOwnMicRoomRef.current !== roomDbId) {
        normalizedOwnMicRoomRef.current = roomDbId;
        const ownSeat = (data ?? []).find((row: { user_id: string | null; seat_status: string; mic_enabled?: boolean }) =>
          row.user_id === cloud?.profile?.id && row.seat_status === "occupied" && row.mic_enabled === true
        );
        if (ownSeat) {
          setMicOn(false);
          const { error: resetMicError } = await (supabase as any).rpc("set_room_seat_mic", {
            p_room_id: roomDbId, p_enabled: false,
          });
          if (resetMicError) console.warn("[room] stale microphone state reset failed:", resetMicError.message);
        }
      }
      if (room.ownerId === cloud?.profile?.id && !(data ?? []).some((row: { seat_number: number; user_id: string | null }) => row.seat_number === 0 && row.user_id === cloud?.profile?.id)) {
        const { error: seatError } = await (supabase as any).rpc("set_room_seat", {
          p_room_id: roomDbId, p_seat_number: 0, p_user_id: cloud?.profile?.id, p_seat_status: "occupied",
        });
        if (seatError) console.warn("[room] host seat initialization failed:", seatError.message);
      }
    };
    void loadSeats();
    const channel = supabase.channel(`room-seats:${roomDbId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_seats", filter: `room_id=eq.${roomDbId}` }, () => { void loadSeats(); })
      .subscribe();
    return () => { cancelled = true; setRoomSeatsLoaded(false); void supabase.removeChannel(channel); };
  }, [live, roomDbId, membershipReady, cloud?.profile?.id, room.ownerId]);

  // All clients derive the room roster from the same room_members rows.
  // Newly observed members trigger the same room-entry announcement/effect on every device.
  useEffect(() => {
    if (!live || !membershipReady) return;
    if (previousMembersRoomId.current !== roomDbId) {
      previousMembersRoomId.current = roomDbId ?? null;
      previousRoomMembers.current = new Set();
      hasLoadedRoomMembers.current = false;
    }
    const ownId = cloud?.profile?.id;
    const current = new Set(roomMemberIds);
    const ids = roomMemberIds.map((uid) => uid === ownId ? "me" : uid);
    if (ownId && !ids.includes("me")) ids.unshift("me");
    setPresent(ids);
    if (!hasLoadedRoomMembers.current) {
      hasLoadedRoomMembers.current = true;
      previousRoomMembers.current = current;
      return;
    }
    for (const uid of current) {
      if (!previousRoomMembers.current.has(uid) && uid !== ownId) {
        sys("دخل الغرفة", uid);
        enqueueEntry(uid);
      }
    }
    previousRoomMembers.current = current;
  }, [roomMemberIds, cloud?.profile?.id, live, membershipReady, roomDbId]);

  // mic activity time for the host center
  const micLive = membershipReady && micOn && mySeat >= 0 && !seats[mySeat]?.muted;
  const { speakingUids, speakingLevels } = useAgoraRoom(id, micLive, membershipReady);
  useEffect(() => {
    if (!micLive) return;
    void cloudAction('activity',{kind:'mic'}).catch(()=>{});
    const t = setInterval(() => {addStat("mic", 15);void cloudAction('activity',{kind:'mic'}).catch(()=>{});}, 15000);
    return () => clearInterval(t);
  }, [micLive]);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [msgs.length, tab]);

  const commitSeats = (makeNext: (current: SeatS[]) => SeatS[]) => {
    if (live && !roomSeatsLoaded) { toast("جارٍ مزامنة المقاعد، حاول بعد لحظة"); return; }
    const next = makeNext(seats);
    setSeats(next);
    if (!live || !roomDbId || !cloud?.profile?.id) return;
    const changes = next.map((seat, index) => ({ seat, index, previous: seats[index] }))
      .filter(({ seat, previous }) => !previous || previous.uid !== seat.uid || previous.locked !== seat.locked || previous.muted !== seat.muted || previous.micEnabled !== seat.micEnabled)
      .sort((a, b) => Number(Boolean(a.seat.uid)) - Number(Boolean(b.seat.uid)));
    void (async () => {
      for (const { seat, index } of changes) {
        const userId = seat.uid === "me" ? cloud.profile!.id : seat.uid;
        const status = seat.locked && !userId ? "locked" : seat.muted && userId ? "muted" : userId ? "occupied" : "available";
        const { error } = await (supabase as any).rpc("set_room_seat", {
          p_room_id: roomDbId, p_seat_number: index, p_user_id: userId || null, p_seat_status: status,
        });
        if (error) { toast(error.message || "تعذّر مزامنة المقعد"); break; }
      }
    })();
  };
  const setSeat = (i: number, patch: Partial<SeatS>) => commitSeats((a) => a.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const sitAt = (i: number, uid: string) => commitSeats((a) => a.map((s, j) => (j === i ? { ...s, uid, muted: false, micEnabled: false } : s.uid === uid ? { ...s, uid: null, muted: false, micEnabled: false } : s)));
  const leaveMic = (uid: string) => commitSeats((a) => a.map((s, j) => (s.uid === uid && j !== 0 ? { ...s, uid: null, muted: false, micEnabled: false } : s)));

  const toggleMyMic = async (enabled: boolean) => {
    if (mySeat < 0) { toast("اصعد على مقعد أولاً"); return; }
    if (seats[mySeat]?.muted && enabled) { toast("مايكك مكتوم من المشرف"); return; }
    const previous = micOn;
    setMicOn(enabled);
    setSeats(current => current.map((seat, index) => index === mySeat ? { ...seat, micEnabled: enabled } : seat));
    if (!live || !roomDbId) return;
    const { error } = await (supabase as any).rpc("set_room_seat_mic", {
      p_room_id: roomDbId, p_enabled: enabled,
    });
    if (error) {
      setMicOn(previous);
      setSeats(current => current.map((seat, index) => index === mySeat ? { ...seat, micEnabled: previous } : seat));
      toast(error.message || "تعذّر مزامنة حالة المايك");
    }
  };

  useEffect(() => {
    if (mySeat >= 0 && seats[mySeat]?.muted && micOn) setMicOn(false);
  }, [mySeat, seats, micOn]);

  const tapSeat = (i: number) => {
    if (live && !roomSeatsLoaded) { toast("جارٍ مزامنة المقاعد، حاول بعد لحظة"); return; }
    const s = seats[i]!;
    if (s.uid && s.uid !== "me") { setSheet({ kind: "user", uid: s.uid }); return; }
    if (s.uid === "me" || can(myRole, "lockSeat")) { setSheet({ kind: "seat", i }); return; }
    if (i === 0) { toast("مقعد المضيف خاص بمالك الغرفة"); return; }
    if (s.locked) { toast("هذا المقعد مقفول"); return; }
    sitAt(i, "me"); sys(`صعد على المقعد No.${i + 1}`, "me");
  };

  const seatActions = (i: number) => {
    const s = seats[i]!;
    const items: { label: string; danger?: boolean; onClick: () => void }[] = [];
    if (s.uid === "me") {
      items.push({ label: micOn ? "إيقاف المايك" : "تشغيل المايك", onClick: () => { void toggleMyMic(!micOn); } });
      items.push({ label: "عرض بطاقتي", onClick: () => setTimeout(() => setSheet({ kind: "user", uid: "me" }), 0) });
      if (i !== 0) items.push({ label: "النزول من المايك", danger: true, onClick: () => { leaveMic("me"); void toggleMyMic(false); sys("نزل من المايك", "me"); } });
      return items;
    }
    if (!s.locked && (i !== 0 || room.hostId === "me")) items.push({ label: "الصعود على المقعد", onClick: () => { sitAt(i, "me"); sys(`صعد على المقعد No.${i + 1}`, "me"); } });
    if (i !== 0 && can(myRole, "inviteToMic") && !s.locked) {
      const free = present.find((u) => u !== "me" && !seated.includes(u));
      if (free) items.push({ label: `دعوة ${user(free).name} للمقعد`, onClick: () => { sitAt(i, free); sys(`صعد على المقعد No.${i + 1} بدعوة من ${meU.name}`, free); } });
    }
    if (i !== 0 && can(myRole, "lockSeat")) items.push({ label: s.locked ? "فتح المقعد" : "قفل المقعد", onClick: () => { setSeat(i, { locked: !s.locked }); toast(s.locked ? "تم فتح المقعد" : "تم قفل المقعد"); } });
    return items;
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    broadcastTyping(false);
    if (!live || !roomDbId || !cloud?.profile?.id) { toast("الدردشة السحابية غير متاحة الآن"); return; }
    void (supabase as any).from("chat_messages").insert({
      room_id: roomDbId, sender_id: cloud.profile.id, message_type: "text", body: t,
    }).then(({ error }: { error: { message: string } | null }) => {
      if (error) toast(error.message || "تعذّر إرسال الرسالة");
      else setText(""); broadcastTyping(false);
    });
  };

  const sendEmoji = (img: string) => {
    setSheet(null);
    if (mySeat < 0) { toast("اصعد على المايك لإرسال الإيموجي"); return; }
    showEmoji("me", img);
  };

  const cloudGifts: ShopGift[] = useMemo(() => cloudState.catalog
    .filter((c) => c.kind === "gift" && c.enabled && c.url)
    .map((c) => {
      const m = (c.metadata ?? {}) as Record<string, unknown>;
      const type = String(m["type"] ?? "static");
      const audioKey = typeof m["audio_asset_key"] === "string" ? m["audio_asset_key"] : "";
      const soundUrl = cloudState.assets.find(a => a.asset_key === audioKey)?.url;
      return { id: c.id, img: c.url, n: c.name, p: c.price, mime: c.mime ?? "", lucky: type === "lucky", animated: type === "animated", full: m["full"] === true, ...(soundUrl ? { soundUrl } : {}) };
    }), [cloudState.catalog, cloudState.assets]);
  const list = cloudGifts.filter((g) => (gTab === "lucky" ? g.lucky : gTab === "animated" ? g.animated : !g.lucky && !g.animated));

  // The database event is the single source of truth for gift visuals. Every
  // member in the room (sender, receiver and listeners) sees the same gift.
  useEffect(() => {
    if (!live || !roomDbId || !membershipReady) return;
    const channel = supabase.channel(`room-gifts:${roomDbId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "room_gift_events",
        filter: `room_id=eq.${roomDbId}`,
      }, (payload) => {
        const event = payload.new as {
          id: string; sender_id: string; receiver_id: string; catalog_id: string;
          gift_name: string; quantity: number; total_price: number;
          lucky_multiplier: number; lucky_win: number;
        };
        const gift = cloudGifts.find((item) => item.id === event.catalog_id);
        if (!gift) {
          void qc.invalidateQueries({ queryKey: ["cloud"] });
          return;
        }
        const senderId = event.sender_id === cloud?.profile?.id ? "me" : event.sender_id;
        const receiverId = event.receiver_id === cloud?.profile?.id ? "me" : event.receiver_id;
        const sender = user(senderId);
        const receiver = user(receiverId);
        const amount = Number(event.quantity) || 1;
        const seatIndex = seats.findIndex((seat) => seat.uid === receiverId);
        if (seatIndex >= 0) setHearts((values) => values.map((value, index) => index === seatIndex ? value + Number(event.total_price) : value));
        push({ kind: "gift", uid: senderId, t: `أرسل ${gift.n} ×${amount} إلى ${receiver.name}`, gift: gift.img });
        if (gift.soundUrl) {
          const audio = new Audio(gift.soundUrl);
          audio.volume = 0.9;
          void audio.play().catch(() => undefined);
        }
        const root = roomRef.current?.getBoundingClientRect();
        const seatEl = roomRef.current?.querySelector<HTMLElement>(`[data-seat-uid="${receiverId}"]`)?.getBoundingClientRect();
        const dx = root && seatEl ? seatEl.left + seatEl.width / 2 - (root.left + root.width / 2) : 0;
        const dy = root && seatEl ? seatEl.top + seatEl.height / 2 - (root.top + root.height * 0.42) : -200;
        setFly({ k: Date.now(), img: gift.img, dx, dy });
        window.setTimeout(() => setFly(null), 2600);
        if (gift.full || gift.mime?.startsWith("video")) {
          setBigGift({ k: Date.now(), g: gift });
          window.setTimeout(() => setBigGift(null), 4200);
        }
        if (gift.lucky) {
          const x = Number(event.lucky_multiplier) || 0;
          const win = Number(event.lucky_win) || 0;
          setLuckyWin({ k: Date.now(), x, win });
          window.setTimeout(() => setLuckyWin(null), 3000);
          if (x > 0) push({ kind: "lucky", uid: senderId, t: `ربح ×${x} من ${gift.n} (+${win.toLocaleString("en")} عملة)`, gift: gift.img });
          if (x >= LUCKY_BANNER_MIN_X) enqueueBanner({ kind: "lucky", from: sender, to: receiver, gift, qty: amount, x });
        } else if (gift.animated || Number(event.total_price) >= LUXURY_BANNER_MIN) {
          enqueueBanner({ kind: "luxury", from: sender, to: receiver, gift, qty: amount });
        }
        if (senderId === "me") void qc.invalidateQueries({ queryKey: ["cloud"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [live, roomDbId, membershipReady, cloudGifts, cloud?.profile?.id, qc]);

  const sendGift = async (g: ShopGift & {id?:string}) => {
    if (giftSending) return;
    if (!g.id) { toast("الهدية غير متاحة حاليًا"); return; }
    const recipient = user(giftTo);
    if (!roomDbId || !recipient.id || recipient.id === cloud?.profile?.id) {
      toast("اختر مستخدمًا موجودًا فعليًا في الغرفة");
      return;
    }
    setGiftSending(true);
    try {
      const { error } = await (supabase as any).rpc("send_catalog_gift", {
        p_catalog_id: g.id,
        p_receiver_id: recipient.id,
        p_room_id: roomDbId,
        p_quantity: qty,
      });
      if (error) throw new Error(error.message);
      setSheet(null);
      void qc.invalidateQueries({ queryKey: ["cloud"] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذّر إرسال الهدية");
    } finally {
      setGiftSending(false);
    }
  };

  const mod = {
    mute: (uid: string) => { const i = seats.findIndex((s) => s.uid === uid); if (i < 0) return; const on = !seats[i]!.muted; setSeat(i, { muted: on }); sys(on ? `تم كتم مايك ${user(uid).name}` : `تم إلغاء كتم ${user(uid).name}`); },
    down: (uid: string) => { leaveMic(uid); sys(`تم إنزال ${user(uid).name} من المايك`); },
    kick: (uid: string) => { leaveMic(uid); setPresent((p) => p.filter((x) => x !== uid)); sys(`تم طرد ${user(uid).name} من الغرفة`); },
    admin: (uid: string) => { const on = roleOf(uid) !== "admin"; setRoles((r) => ({ ...r, [uid]: on ? "admin" : "member" })); sys(on ? `تم تعيين ${user(uid).name} مشرفاً` : `تمت إزالة ${user(uid).name} من الإشراف`); },
  };

  const shown = (tab === 0 ? msgs : msgs.filter((m) => m.kind === "chat")).filter((m) => m.kind !== "gift" && m.kind !== "lucky");
  const giftTargets = [...new Set(roomMemberIds.filter((uid) => uid !== cloud?.profile?.id))];
  const onlineCount = Math.max(room.online, present.length);
  const leave = () => { if (router.history.canGoBack()) router.history.back(); else void nav({ to: "/", replace: true }); };
  const minimize = () => { setExitMenu(false); leave(); };
  const close = async () => {
    setExitMenu(false);
    setMicOn(false);
    if (live && roomDbId) {
      const { data, error } = await supabase.rpc("leave_room", { p_room_id: roomDbId });
      if (error || data !== true) {
        toast(error?.message || "تعذّر تسجيل مغادرة الغرفة؛ حاول مرة أخرى");
        return;
      }
    }
    setMembershipReady(false);
    setActiveRoom(null);
    leave();
  };

  const tools = [
    {n:'الأغاني',i:Music2,ok:true,f:()=>setSheet({kind:'music'})},
    { n: "المتواجدون", i: Users, ok: true, f: () => setSheet({ kind: "members" }) },
    { n: "الرسائل", i: Mail, ok: true, f: () => { setSheet(null); setExitMenu(false); void nav({ to: "/messages", replace: true }); } },
    { n: "مشاركة", i: Share2, ok: true, f: () => { setSheet(null); toast("تم نسخ رابط الغرفة"); } },
    { n: "تعديل الغرفة", i: Pencil, ok: can(myRole, "editRoom"), f: () => setSheet({ kind: "edit" }) },
    { n: "مسح الدردشة", i: Trash2, ok: can(myRole, "clearChat"), f: () => {
      if (!live || !roomDbId) { toast("الدردشة السحابية غير متاحة الآن"); return; }
      void (supabase as any).rpc("clear_room_chat", { p_room_id: roomDbId }).then(({ error }: { error: { message: string } | null }) => {
        if (error) { toast(error.message || "تعذّر مسح الدردشة"); return; }
        setMsgs((m) => m.filter((x) => x.kind === "notice"));
        seenChatIds.current.clear();
        setSheet(null);
        toast("تم مسح الدردشة للجميع");
      });
    } },
    { n: "قفل المقاعد", i: Lock, ok: can(myRole, "lockSeat"), f: () => { commitSeats((a) => a.map((s, i) => (i && !s.uid ? { ...s, locked: true } : s))); setSheet(null); toast("تم قفل كل المقاعد الفارغة"); } },
    { n: "فتح المقاعد", i: UserPlus, ok: can(myRole, "lockSeat"), f: () => { commitSeats((a) => a.map((s) => ({ ...s, locked: false }))); setSheet(null); toast("تم فتح المقاعد"); } },
    { n: "كتم الجميع", i: VolumeX, ok: can(myRole, "muteAll"), f: () => { commitSeats((a) => a.map((s) => (s.uid && s.uid !== "me" ? { ...s, muted: true } : s))); setSheet(null); sys("قام المالك بكتم جميع المايكات"); } },
    { n: "إلغاء الكتم", i: Volume2, ok: can(myRole, "muteAll"), f: () => { commitSeats((a) => a.map((s) => ({ ...s, muted: false }))); setSheet(null); sys("تم إلغاء كتم الجميع"); } },
  ].filter((t) => t.ok);

  return (
    <div ref={roomRef} dir="rtl" className={`fixed inset-0 z-50 mx-auto max-w-[440px] overflow-hidden bg-night text-night-foreground ${minimized ? "hidden" : ""}`}>
      <img src={roomBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-b from-night/50 via-night/10 to-night/90" />
      {roomFrameUrl && (
        <img
          src={roomFrameUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[35] h-full w-full object-contain"
        />
      )}
      <div className="relative flex h-full flex-col">
        {cloud?.catalog.filter(c=>c.kind==='welcome'&&c.enabled).map(c=><div key={c.id} className="relative mx-3 mt-2 flex items-center gap-2 rounded-lg bg-night/70 px-3 py-2 text-[11px]">{c.url&&<img src={c.url} alt="" className="h-8 w-10 object-contain"/>}{c.description||c.name}</div>)}
        {/* top bar */}
        <div className="flex items-center justify-between gap-2 px-3 pt-3">
          <div className="room-pill flex min-w-0 items-center gap-1.5 rounded-full py-0.5 pe-1 ps-0.5">
            <img src={roomCover} alt="" className="h-9 w-9 shrink-0 rounded-full border border-gold/60 object-cover" />
            <div className="min-w-0">
              <p className="max-w-[118px] truncate text-[12.5px] font-extrabold leading-tight">{roomName}</p>
              <span className="id-chip mt-0.5 inline-flex items-center gap-0.5 rounded-full pe-1 text-[9px] font-bold leading-[14px]" dir="ltr"><span className="id-tag rounded-full px-1 text-[7.5px] font-black">ID</span>{live ? room.id : `10${room.id}3143`}</span>
            </div>
            {room.hostId !== "me" && <button onClick={() => { setFollow((f) => !f); toast(follow ? "تم إلغاء متابعة الغرفة" : "تمت متابعة الغرفة"); }} aria-label="متابعة" className="press grid h-6 w-6 shrink-0 place-items-center rounded-full gold-bg text-navy">{follow ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}</button>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => setSheet({ kind: "members" })} className="flex items-center gap-1" aria-label="المتواجدون">
              <span className="flex -space-x-2 space-x-reverse">{present.slice(-3).map((u) => <img key={u} src={user(u).avatar} alt="" className="h-6 w-6 rounded-full border border-night object-cover" />)}</span>
              <span className="rounded-full night-glass px-2 py-0.5 text-[11px] font-bold">{onlineCount}</span>
            </button>
            <div className="relative">
              <button onClick={() => setExitMenu((v) => !v)} aria-label="خروج" className={`press grid h-8 w-8 place-items-center rounded-full ${exitMenu ? "bg-night-foreground text-night" : "night-glass"}`}><Power className="h-4 w-4" /></button>
              {exitMenu && (
                <>
                  <button aria-label="إغلاق القائمة" className="fixed inset-0 z-40 cursor-default" onClick={() => setExitMenu(false)} />
                  <div className="pop-in absolute left-0 top-10 z-50 flex gap-3 rounded-2xl border border-ice/25 bg-night/95 p-3 shadow-2xl backdrop-blur">
                    <button onClick={minimize} className="press flex w-14 flex-col items-center gap-1 text-[11px] font-bold"><span className="grid h-11 w-11 place-items-center rounded-full bg-primary"><Minimize2 className="h-5 w-5" /></span>تصغير</button>
                    <button onClick={close} className="press flex w-14 flex-col items-center gap-1 text-[11px] font-bold"><span className="grid h-11 w-11 place-items-center rounded-full bg-destructive"><X className="h-5 w-5" /></span>إغلاق</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 px-3">
          <Link to="/wallet" className="flex items-center gap-1 rounded-full night-glass px-2 py-0.5 text-[11px]"><Coin n={profile.coins} /></Link>
          <span className="flex items-center gap-1 rounded-full night-glass px-2 py-0.5 text-[11px]"><Heart className="h-3 w-3 fill-badge text-badge" />{hearts.reduce((a, b) => a + b, 0).toLocaleString("en")}</span>
        </div>

        {/* seats */}
        <div className="mt-7 grid grid-cols-4 gap-y-5 px-2">
          {seats.map((s, i) => {
            const u = s.uid ? user(s.uid) : null;
            const myMicOff = !!u && !s.micEnabled;
            const isTyping = !!u && (s.uid === "me" ? !!text.trim() : typingUids.has(u.id));
            const speakerUid = u?.uid ? String(u.uid) : "";
            const speaking = !!u && !s.muted && speakingUids.has(speakerUid);
            const speakingLevel = speakingLevels.get(speakerUid) ?? 0;
            const e = s.uid ? emo[s.uid] : undefined;
            return (
              <button key={i} onClick={() => tapSeat(i)} data-seat-uid={s.uid ?? undefined} className="relative flex flex-col items-center">
                <span className="relative grid h-[60px] w-[60px] place-items-center">
                  <span className="seat-shadow" />
                  {speaking && (
                    <>
                      <span className="voice-wave" style={{ "--voice-level": Math.max(0.55, speakingLevel / 70) } as CSSProperties} />
                      <span className="voice-wave voice-wave-2" style={{ "--voice-level": Math.max(0.65, speakingLevel / 60) } as CSSProperties} />
                      <span className="voice-wave voice-wave-3" style={{ "--voice-level": Math.max(0.75, speakingLevel / 50) } as CSSProperties} />
                    </>
                  )}
                  {u ? (
                    <Avatar img={u.avatar} frame={u.frame} size={54} ring={s.muted ? "seat-muted" : speaking ? "ring-2 ring-ice/80" : ""} />
                  ) : s.locked ? (
                    <span className="relative grid h-[54px] w-[54px] place-items-center"><img src={seatArt} alt="" className="h-12 w-12 object-contain opacity-45 grayscale-[60%]" /><span className="absolute bottom-0 grid h-5 w-5 place-items-center rounded-full bg-night/85"><Lock className="h-3 w-3 text-gold" strokeWidth={2.6} /></span></span>
                  ) : (
                    <img src={seatArt} alt="" className="seat-float h-12 w-12 object-contain" />
                  )}
                  {u && s.muted && <span className="mic-badge mic-badge-muted absolute z-[30] -bottom-0.5 left-0 grid h-[18px] w-[18px] place-items-center rounded-full"><MicOff className="h-2.5 w-2.5" strokeWidth={3} /></span>}
                  {u && !s.muted && myMicOff && <span className="mic-badge absolute z-[30] -bottom-0.5 left-0 grid h-[18px] w-[18px] place-items-center rounded-full"><MicOff className="h-2.5 w-2.5" strokeWidth={3} /></span>}
                  {u && s.uid && <span className="absolute -bottom-0.5 right-0"><RoleBadge role={roleOf(s.uid)} className="h-4 w-4" /></span>}
                  {e && <img key={e.k} src={e.img} alt="" className="emoji-pop pointer-events-none absolute z-20 h-12 w-12" />}
                  {isTyping && !e && (
                    <span className="typing-bubble pop-in absolute -top-6 left-1/2 z-10 flex h-[18px] -translate-x-1/2 items-center gap-[3px] rounded-full px-2">
                      <i className="typing-dot" /><i className="typing-dot" /><i className="typing-dot" />
                    </span>
                  )}
                </span>
                <span className="relative z-[1] seat-name mt-3 flex max-w-[78px] items-center gap-0.5 text-[10.5px] font-bold">{speaking && <span className="eq shrink-0"><i /><i /><i /></span>}<span className="user-name">{u ? u.name : i === 0 ? "المضيف" : s.locked ? "مقفول" : `No.${i + 1}`}</span></span>
                <span className="flex items-center gap-0.5 rounded-full night-glass px-1.5 text-[9.5px] leading-4"><Heart className="h-2.5 w-2.5 fill-badge text-badge" />{hearts[i]!.toLocaleString("en")}</span>
              </button>
            );
          })}
        </div>

        {entry && <div className="pointer-events-none fixed inset-x-0 bottom-[72px] z-[35] mx-auto w-full max-w-[440px]"><EntryShow key={entry.k} u={user(entry.uid)} /></div>}

        {/* chat tabs */}
        <div className="mt-3 flex items-center gap-5 px-4 text-[13.5px]">
          {["الكل", "الدردشة"].map((l, i) => (
            <button key={l} onClick={() => setTab(i)} className={`relative shrink-0 whitespace-nowrap pb-1 ${tab === i ? "font-black" : "opacity-60"}`}>
              <span className={tab === i ? "room-tab-on" : ""}>{l}</span>{tab === i && <span className="gold-bg absolute bottom-0 right-1/2 h-[3px] w-5 translate-x-1/2 rounded-full" />}
            </button>
          ))}
        </div>
        {typingUids.size > 0 && <p className="px-4 text-[10.5px] text-ice/90">{[...typingUids].map(uid => user(uid).name).filter(Boolean).join("، ")} يكتب الآن...</p>}
        <div ref={chatRef} className="no-scrollbar mt-1.5 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
          {shown.map((m) => {
            if (m.kind === "notice") return <div key={m.id} className="rounded-xl border border-ice/30 bg-primary/25 px-2.5 py-1.5 text-[11.5px] leading-snug"><span className="font-bold text-ice">إعلان: </span>{m.t}</div>;
            const u = m.uid ? user(m.uid) : null;
            if (m.kind !== "chat") return (
              <div key={m.id} className={`inline-flex w-fit max-w-[92%] items-center gap-1.5 rounded-2xl px-3 py-1 text-[11.5px] leading-snug ${m.kind === "lucky" ? "lucky-chip" : m.kind === "gift" ? "gift-chip" : "night-glass"}`}>
                {m.gift && <img src={m.gift} alt="" className="h-5 w-5 shrink-0 object-contain drop-shadow" />}
                <span className="min-w-0">
                  {u && <button onClick={() => setSheet({ kind: "user", uid: m.uid! })} className="me-1 font-extrabold text-gold"><UserName uid={u.uid} name={u.name}/></button>}
                  <span className="opacity-95">{m.t}</span>
                </span>
              </div>
            );
            return (
              <div key={m.id} className="flex items-start gap-1.5">
                <button onClick={() => setSheet({ kind: "user", uid: m.uid! })} className="mt-0.5 shrink-0"><Avatar img={u!.avatar} frame={u!.frame} size={30} /></button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[10.5px]">
                    <span className="user-name max-w-[140px] font-bold text-ice">{u!.name}</span>
                    <RoleBadge role={roleOf(m.uid!)} className="h-3.5 w-3.5" /><LevelChip level={u!.level} /><VipChip vip={u!.vip} />
                  </div>
                  <ChatText bubble={u!.bubble} text={m.t}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* bottom dock */}
        <div className="room-dock mx-2.5 mb-3 flex items-center gap-1.5 rounded-full p-1.5">
          <div className="dock-input flex h-10 min-w-0 flex-1 items-center rounded-full ps-3.5 pe-1.5">
            <input value={text} onChange={(e) => { const value = e.target.value; setText(value); broadcastTyping(!!value.trim()); }} onKeyDown={(e) => e.key === "Enter" && send()} maxLength={120} placeholder="اكتب رسالة للغرفة..." className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-night-foreground/55" />
            {text.trim() && <button onClick={send} aria-label="إرسال" className="pop-in grid h-7 w-7 shrink-0 place-items-center rounded-full gold-bg text-navy shadow"><Send className="h-3.5 w-3.5 -scale-x-100" /></button>}
          </div>
          <button onClick={() => setSheet({ kind: "emoji" })} aria-label="إيموجي" className="dock-btn"><Smile className="h-[18px] w-[18px]" /></button>
          <button onClick={() => { if (mySeat < 0) { toast("اصعد على مقعد أولاً"); return; } if (seats[mySeat]!.muted) { toast("مايك مكتوم من المشرف"); return; } void toggleMyMic(!micOn); }} aria-label="المايك" className={`dock-btn ${micOn && mySeat >= 0 ? "dock-btn-on" : ""}`}>{micOn && mySeat >= 0 ? <Mic className="h-[18px] w-[18px]" /> : <MicOff className="h-[18px] w-[18px] opacity-80" />}</button>
          <button onClick={() => setSheet({ kind: "menu" })} aria-label="القائمة" className="dock-btn relative"><LayoutGrid className="h-[18px] w-[18px]" /><span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-badge" /></button>
          <button onClick={() => { setGiftTo(giftTargets[0] ?? room.hostId); setSheet({ kind: "gift" }); }} aria-label="الهدايا" className="gift-box-3d press grid h-10 w-10 shrink-0 place-items-center rounded-full text-navy">
            <GiftIcon className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {banner && <GiftBanner key={banner.k} b={banner} />}
      {bigGift && <div key={bigGift.k} className="big-gift pointer-events-none absolute inset-0 z-40 grid place-items-center"><Media src={bigGift.g.img} mime={bigGift.g.mime} className="h-[70%] w-full" loop={false}/><p className="big-gift-name absolute bottom-[18%] rounded-full px-4 py-1 text-[13px] font-black">{meU.name} أرسل {bigGift.g.n} ×{qty}</p></div>}
      {luckyWin && <div key={luckyWin.k} className="lucky-pop pointer-events-none absolute inset-x-0 top-[38%] z-40 mx-auto w-fit rounded-2xl px-5 py-2 text-center">{luckyWin.x > 0 ? <><b className="block text-[26px] font-black italic">×{luckyWin.x}</b><span className="text-[12px] font-bold">ربحت {luckyWin.win.toLocaleString("en")} عملة</span></> : <span className="text-[12px] font-bold">حظ أوفر المرة القادمة</span>}</div>}
      {fly && (
        <div key={fly.k} className="pointer-events-none absolute inset-x-0 top-[42%] z-40 flex h-0 justify-center">
          <div className="gift-send-fx" style={{ "--gdx": `${fly.dx}px`, "--gdy": `${fly.dy}px` } as CSSProperties}>
            <span className="gift-fx-glow" />
            <img src={fly.img} alt="" className="relative h-44 w-44 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]" />
          </div>
        </div>
      )}
      <Sheet open={sheet?.kind === "user"} onClose={() => setSheet(null)}>
        {sheet?.kind === "user" && (
          <UserCard u={user(sheet.uid)} self={sheet.uid === "me"} role={roleOf(sheet.uid)} myRole={myRole} onMic={seated.includes(sheet.uid)} muted={!!seats.find((s) => s.uid === sheet.uid)?.muted}
            following={profile.following.includes(sheet.uid)}
            onFollow={() => toast(toggleFollow(sheet.uid) ? "تمت المتابعة" : "تم إلغاء المتابعة")}
            onGift={() => {
              const targetId = roomMemberIds.includes(user(sheet.uid).id)
                ? user(sheet.uid).id
                : roomMemberIds.find((uid) => uid !== cloud?.profile?.id);
              if (!targetId) { toast("لا يوجد مستخدم حاليًا داخل الغرفة لإرسال الهدية"); return; }
              setGiftTo(targetId);
              setSheet({ kind: "gift" });
            }}
            onMention={() => { setText((t) => `@${user(sheet.uid).name} ${t}`); setSheet(null); }}
            onMessage={() => { const target = sheet.uid; setSheet(null); setExitMenu(false); void nav({ to: "/messages", search: { chat: target }, replace: true }); }}
            onMod={(a) => { mod[a](sheet.uid); setSheet(null); }} />
        )}
      </Sheet>

      <Sheet open={sheet?.kind === "seat"} onClose={() => setSheet(null)}>
        {sheet?.kind === "seat" && <><p className="pt-2 text-center text-[12px] text-muted-foreground">{sheet.i === 0 ? "مقعد المضيف" : `المقعد No.${sheet.i + 1}`}</p><ActionList items={seatActions(sheet.i)} onClose={() => setSheet((s) => (s?.kind === "seat" ? null : s))} /></>}
      </Sheet>

      <Sheet open={sheet?.kind === "emoji"} onClose={() => setSheet(null)} dark title="إيموجي متحرك">
        <div className="grid grid-cols-6 gap-y-2 px-3 pb-2 pt-1">
          {emojis.map((e) => <button key={e.k} onClick={() => sendEmoji(e.img)} className="press grid h-12 place-items-center rounded-xl active:bg-night-foreground/10"><img src={e.img} alt="" className="h-10 w-10" /></button>)}
        </div>
        <p className="px-4 text-center text-[10.5px] opacity-60">يظهر الإيموجي فوق صورتك على المايك</p>
      </Sheet>

      <Sheet open={sheet?.kind === "menu"} onClose={() => setSheet(null)} dark title="أدوات الغرفة">
        <div className="grid grid-cols-4 gap-y-3 px-3 pt-2">
          {tools.map((t) => (
            <button key={t.n} onClick={t.f} className="press flex flex-col items-center gap-1">
              <span className="tool-tile grid h-12 w-12 place-items-center rounded-2xl"><t.i className="h-5 w-5 text-ice drop-shadow" /></span>
              <span className="text-[10.5px]">{t.n}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet?.kind === "members"} onClose={() => setSheet(null)} title={`المتواجدون (${present.length})`}>
        <div className="divide-y divide-border/60 px-3">
          {[...present].sort((a, b) => ["owner", "admin", "member"].indexOf(roleOf(a)) - ["owner", "admin", "member"].indexOf(roleOf(b))).map((uid) => { const u = user(uid); return (
            <button key={uid} onClick={() => setSheet({ kind: "user", uid })} className="flex w-full items-center gap-2.5 py-2 text-start">
              <Avatar img={u.avatar} frame={u.frame} size={42} className="m-1.5" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-[13px] font-bold text-navy"><span className="user-name">{uid === "me" ? `${u.name} (أنا)` : u.name}</span><RoleBadge role={roleOf(uid)} /></p>
                <div className="flex items-center gap-1"><LevelChip level={u.level} /><VipChip vip={u.vip} /><SpecialId uid={u.uid} sid={u.sid} className="text-navy" /></div>
              </div>
              {roleOf(uid) !== "member" && <span className="text-[10.5px] text-muted-foreground">{roleLabel[roleOf(uid)]}</span>}
            </button>
          ); })}
        </div>
      </Sheet>

      <Sheet open={sheet?.kind === "edit"} onClose={() => setSheet(null)} title="تعديل الغرفة">
        <EditRoom
          name={roomName}
          notice={msgs.find((m) => m.kind === "notice")?.t ?? room.notice}
          cover={roomCover}
          bg={roomBg}
          hasCustomCover={live ? false : Boolean(roomOv?.cover)}
          hasCustomBg={Boolean(roomOv?.bg)}
          onSave={async (n, t, cover, bg) => {
            try {
              if (live) {
                const uploadedCover = cover ? await uploadImageDataUrl(cover, "room-covers") : null;
                const uploadedBackground = bg ? await uploadImageDataUrl(bg, "room-backgrounds") : null;
                const { error } = await (supabase as any).rpc("save_room_settings", { p_name: n, p_notice: t, p_cover_url: uploadedCover, p_background_url: uploadedBackground });
                if (error) throw new Error(error.message || "تعذّر حفظ إعدادات الغرفة");
                setRoomName(n);
                await qc.invalidateQueries({ queryKey: ["cloud"] });
              } else {
                setRoomName(n);
                setRoomMedia(id, { name: n, notice: t, cover, bg });
              }
              setMsgs((m) => m.map((x) => (x.kind === "notice" ? { ...x, t } : x)));
              setSheet(null);
              toast("تم حفظ إعدادات الغرفة");
            } catch (error) {
              toast(error instanceof Error ? error.message : "تعذّر حفظ صورة الغرفة");
            }
          }}
        />
      </Sheet>

      <Sheet open={sheet?.kind === "gift"} onClose={() => setSheet(null)} dark>
        <div className="gift-tray-anim">
        <div className="no-scrollbar flex items-center gap-2.5 overflow-x-auto px-3 pb-2 pt-1">
          {giftTargets.filter((u) => u !== "me").map((uid) => {
            const si = seats.findIndex((s) => s.uid === uid);
            return (
              <button key={uid} aria-label={`إرسال إلى ID ${user(uid).uid}`} onClick={() => setGiftTo(uid)} className="relative flex shrink-0 flex-col items-center">
                <img src={user(uid).avatar} alt="" className={`h-9 w-9 rounded-full object-cover transition ${giftTo === uid ? "gold-ring" : "opacity-50"}`} />
                {si >= 0 && <span className="absolute -bottom-1 rounded-full bg-primary px-1 text-[8px] font-black leading-3">{si === 0 ? "مضيف" : si + 1}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-3">
          <div className="gift-tabs my-1.5 flex gap-1 rounded-full p-1">
            {giftTabs.map((t) => (
              <button key={t.k} onClick={() => { setGTab(t.k); setGSel(0); }} className={`flex h-7 items-center gap-1 rounded-full px-3 text-[12.5px] transition ${gTab === t.k ? "gold-bg font-black text-navy shadow-md" : "opacity-70"}`}>
                {t.n}
              </button>
            ))}
          </div>
          <Link to="/wallet" onClick={() => setSheet(null)} className="flex items-center gap-1 text-[11.5px]"><Coin n={profile.coins} /><span className="text-gold">›</span></Link>
        </div>
        <div className="grid min-h-[176px] grid-cols-4 content-start gap-1.5 px-3 pt-2">
          {list.map((g, i) => (
            <button key={g.id ?? g.n} onClick={() => setGSel(i)} className={`gift-cell relative flex flex-col items-center rounded-xl py-1.5 ${gSel === i ? "gift-cell-on" : ""}`}>
              <Media src={g.img} mime={g.mime} alt={g.n} className={`h-11 w-11 ${gSel === i ? "gift-bob" : ""}`} />
              <span className="mt-0.5 text-[11px]">{g.n}</span>
              <span className="text-[10px] text-gold"><Coin n={g.p} /></span>
            </button>
          ))}
          {!list.length && <p className="col-span-4 py-8 text-center text-[12px] text-night-foreground/70">لا توجد هدايا منشورة حاليًا</p>}
        </div>
        <div className="mt-3 flex items-center gap-2 px-3">
          <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
            {QTYS.map((q) => <button key={q} onClick={() => setQty(q)} className={`h-7 shrink-0 rounded-full px-2.5 text-[11.5px] font-bold ${qty === q ? "gold-bg text-navy" : "border border-night-foreground/20"}`}>×{q}</button>)}
          </div>
          <button disabled={giftSending || !giftTargets.length || !list[gSel]} onClick={() => list[gSel] && void sendGift(list[gSel]!)} className="press flex h-9 shrink-0 items-center gap-1.5 rounded-full gold-bg px-4 text-[13px] font-black text-navy shadow-lg disabled:opacity-50">
            <span>{giftSending ? "جارٍ الإرسال..." : "إرسال"}</span>
            {list[gSel] && <span className="rounded-full bg-navy/15 px-1.5 py-0.5 text-[10.5px]">{(list[gSel]!.p * qty).toLocaleString("en")}</span>}
          </button>
        </div>
        </div>
      </Sheet>
      <RoomMusic open={sheet?.kind==='music'} onClose={()=>setSheet(null)}/>
    </div>
  );
}

function GiftBanner({ b }: { b: Banner }) {
  const lucky = b.kind === "lucky";
  const x = b.x ?? 0;
  const value = b.gift.p * b.qty;
  const tier = lucky ? luckyTier(x) ?? "lucky" : luxuryTier(value) ?? "gold";
  const big = tier === "legend" || tier === "jackpot";
  const style = b.gift.bannerStyle ?? "luxury";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[84px] z-30 h-[120px]">
      {big && <div className="coin-rain absolute inset-x-0 -top-[84px] h-[60vh] overflow-hidden">{Array.from({ length: 14 }, (_: undefined, i: number) => <img key={i} src={ui.coin} alt="" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.22}s` }} />)}</div>}
      <div className={`gift-banner gb gb-${tier} gb-style-${style} relative mx-auto mt-3 h-[64px] w-[344px]`}>
        <span className="gb-wing gb-wing-r" /><span className="gb-wing gb-wing-l" />
        <div className="gb-frame absolute inset-0 rounded-[20px] p-[2px]">
          <div className="gb-plate relative flex h-full items-center gap-2 overflow-hidden rounded-[18px] pe-[74px] ps-2">
            <Avatar img={b.from.avatar} frame={b.from.frame} size={40} ring="gb-avatar" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[12px] font-black">{b.from.name}</p>
              {lucky ? (
                <p className="truncate text-[10.5px]">ربح من <b>{b.gift.n}</b> <span className="gb-amount">{(b.gift.p * b.qty * x).toLocaleString("en")}</span></p>
              ) : (
                <p className="truncate text-[10.5px]">أرسل <b>{b.gift.n}</b> إلى <b>{b.to.name}</b></p>
              )}
            </div>
            <span className="gb-gloss" />
          </div>
        </div>
        <div className="absolute -top-5 left-1 flex w-[78px] flex-col items-center">
          <span className="gb-halo absolute top-1 h-16 w-16 rounded-full" />
          <img src={b.gift.img} alt="" className="banner-gift relative h-[60px] w-[60px] object-contain" />
          <span className="gb-num relative -mt-2 text-[22px] font-black leading-none" dir="ltr">×{lucky ? x : b.qty}</span>
        </div>
        {[8, 26, 47, 63, 81, 94].map((l, i) => <i key={l} className="gb-spark" style={{ left: `${l}%`, top: i % 2 ? "-6px" : "58px", animationDelay: `${i * 0.25}s` }} />)}
      </div>
    </div>
  );
}

function UserCard({ u, self, role, myRole, onMic, muted, following, onFollow, onGift, onMention, onMessage, onMod }: {
  u: User; self: boolean; role: Role; myRole: Role; onMic: boolean; muted: boolean; following: boolean;
  onFollow: () => void; onGift: () => void; onMention: () => void; onMessage: () => void; onMod: (a: "mute" | "down" | "kick" | "admin") => void;
}) {
  const acts: { k: "mute" | "down" | "kick" | "admin"; n: string; ok: boolean; danger?: boolean }[] = self ? [] : [
    { k: "mute", n: muted ? "إلغاء الكتم" : "كتم المايك", ok: onMic && can(myRole, "mute", role) },
    { k: "down", n: "إنزال من المايك", ok: onMic && can(myRole, "kickFromMic", role) },
    { k: "admin", n: role === "admin" ? "إزالة الإشراف" : "تعيين مشرف", ok: can(myRole, "setAdmin", role) },
    { k: "kick", n: "طرد من الغرفة", ok: can(myRole, "kickFromRoom", role), danger: true },
  ];
  const allowed = acts.filter((a) => a.ok);
  return (
    <div className="px-4">
      <div className="flex items-start gap-3 pt-3">
        <Avatar img={u.avatar} frame={u.frame} size={72} className="m-3" />
        <div className="min-w-0 flex-1 pt-2">
          <p className="flex items-center gap-1 text-[16px] font-black text-navy"><UserName className="user-name" uid={u.uid} name={u.name}/><span className="text-[13px]">{u.flag}</span></p>
          <div className="mt-0.5"><SpecialId uid={u.uid} sid={u.sid} className="text-navy" /></div>
          <UserBadges userId={self ? readCloud().profile?.id ?? "" : u.id} align="start" size={22} />
          <div className="mt-1 flex flex-wrap items-center gap-1"><GenderChip g={u.gender} /><LevelChip level={u.level} /><VipChip vip={u.vip} />{role !== "member" && <span className="flex items-center gap-0.5 rounded-full bg-secondary px-1.5 text-[9.5px] font-bold leading-4 text-navy"><RoleBadge role={role} className="h-3.5 w-3.5" />{roleLabel[role]}</span>}</div>
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{u.bio}</p>
      <div className="mt-2 grid grid-cols-3 rounded-xl bg-secondary py-2 text-center">
        {[["المتابعون", u.fans], ["المتابَعون", u.following], ["الكاريزما", u.charm]].map(([l, n]) => <div key={l as string}><p className="text-[14px] font-black text-navy">{(n as number).toLocaleString("en")}</p><p className="text-[10.5px] text-muted-foreground">{l}</p></div>)}
      </div>
      {u.entry && <div className="mt-2 flex items-center gap-2 rounded-xl bg-secondary px-2 py-1"><img src={entries[u.entry].img} alt="" className="h-8 w-12 object-contain" /><span className="text-[11.5px] text-navy">مركبة الدخول: <b>{entries[u.entry].n}</b></span></div>}
      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] font-bold">
        {!self && <button onClick={onFollow} className={`press flex flex-col items-center gap-1 rounded-xl py-2 ${following ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"}`}>{following ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{following ? "متابَع" : "متابعة"}</button>}
        {!self && <button onClick={onGift} className="press flex flex-col items-center gap-1 rounded-xl gold-bg py-2 text-navy"><GiftIcon className="h-4 w-4" />هدية</button>}
        {!self && <button onClick={onMention} className="press flex flex-col items-center gap-1 rounded-xl bg-secondary py-2 text-navy"><AtSign className="h-4 w-4" />إشارة</button>}
        {!self && <button onClick={onMessage} className="press flex flex-col items-center gap-1 rounded-xl bg-secondary py-2 text-navy"><MessageCircle className="h-4 w-4 text-primary" />رسالة</button>}
      </div>
      <Link to="/user/$id" params={{ id: u.id }} className="press mt-2 block rounded-full border border-primary py-2 text-center text-[13px] font-bold text-primary">عرض الملف الشخصي</Link>
      {self && <Link to="/me/edit" className="press mt-2 block rounded-full gold-bg py-2 text-center text-[13px] font-black text-navy">تعديل ملفي الشخصي</Link>}
      {allowed.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-2">
          <div className="grid grid-cols-2 gap-2">
            {allowed.map((a) => <button key={a.k} onClick={() => onMod(a.k)} className={`press rounded-xl py-2 text-[12px] font-bold ${a.danger ? "bg-destructive/10 text-destructive" : "bg-secondary text-navy"}`}>{a.n}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

function EditRoom({ name, notice, cover, bg, hasCustomCover, hasCustomBg, onSave }: {
  name: string; notice: string; cover: string; bg: string; hasCustomCover: boolean; hasCustomBg: boolean;
  onSave: (n: string, t: string, cover: string | null, bg: string | null) => void | Promise<void>;
}) {
  const [n, setN] = useState(name);
  const [t, setT] = useState(notice);
  const [cImg, setCImg] = useState<string | null>(hasCustomCover ? cover : null);
  const [bImg, setBImg] = useState<string | null>(hasCustomBg ? bg : null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const bgRef = useRef<HTMLInputElement | null>(null);

  const pick = async (file: File | undefined, kind: "cover" | "bg") => {
    if (!file) return;
    try {
      const url = await readImageFile(file, kind === "bg" ? 720 : 420, 0.8);
      if (kind === "cover") setCImg(url);
      else setBImg(url);
      toast(kind === "cover" ? "تم اختيار صورة الغرفة" : "تم اختيار خلفية الغرفة");
    } catch {
      toast("تعذّر قراءة الصورة، اختر ملف صورة صالحاً");
    }
  };

  return (
    <div className="space-y-3 px-4 pt-1">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-secondary p-2 text-center">
          <img src={cImg || cover} alt="صورة الغرفة" className="mx-auto h-16 w-16 rounded-xl object-cover shadow" />
          <button type="button" onClick={() => coverRef.current?.click()} className="press mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            <ImageIcon className="h-3 w-3" />صورة الغرفة
          </button>
          {cImg && <button type="button" onClick={() => setCImg(null)} className="mt-1 block w-full text-[10px] text-destructive">استعادة الافتراضية</button>}
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0], "cover"); e.target.value = ""; }} />
        </div>
        <div className="rounded-xl bg-secondary p-2 text-center">
          <img src={bImg || bg} alt="خلفية الغرفة" className="mx-auto h-16 w-full rounded-xl object-cover shadow" />
          <button type="button" onClick={() => bgRef.current?.click()} className="press mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            <ImageIcon className="h-3 w-3" />خلفية الغرفة
          </button>
          {bImg && <button type="button" onClick={() => setBImg(null)} className="mt-1 block w-full text-[10px] text-destructive">استعادة الافتراضية</button>}
          <input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0], "bg"); e.target.value = ""; }} />
        </div>
      </div>
      <label className="block text-[12px] font-bold text-muted-foreground">اسم الغرفة<input value={n} maxLength={24} onChange={(e) => setN(e.target.value)} className="mt-1 w-full rounded-xl bg-secondary px-3 py-2 text-[14px] text-navy outline-none" /></label>
      <label className="block text-[12px] font-bold text-muted-foreground">إعلان الغرفة<textarea value={t} maxLength={120} rows={3} onChange={(e) => setT(e.target.value)} className="mt-1 w-full resize-none rounded-xl bg-secondary px-3 py-2 text-[13px] text-navy outline-none" /></label>
      <button onClick={() => { if (n.trim()) void onSave(n.trim(), t.trim(), cImg, bImg); }} className="press w-full rounded-full gold-bg py-2.5 text-[14px] font-black text-navy">حفظ</button>
    </div>
  );
}

function EntryShow({ u }: { u: User }) {
  const {catalog, assets}=useCloudState();
  const cloud = u.entry?.startsWith("cloud-") ? catalog.find(c=>`cloud-${c.id}`===u.entry) : undefined;
  const meta=(cloud?.metadata ?? {}) as Record<string, unknown>;
  const audioKey=typeof meta["audio_asset_key"] === "string" ? meta["audio_asset_key"] : "";
  const sound=assets.find(a=>a.asset_key===audioKey)?.url;
  useEffect(() => {
    if (!sound) return;
    const audio = new Audio(sound);
    audio.volume = 0.9;
    void audio.play().catch(() => undefined);
    return () => { audio.pause(); audio.currentTime = 0; };
  }, [sound]);
  return (
    <div className="entry-strip pointer-events-none absolute inset-x-0 bottom-0 z-40 h-12 overflow-hidden" role="status" aria-label="دخول الغرفة">
      <div className={`entry-strip-track ${u.vip >= 5 ? "entry-strip-gold" : ""} flex h-full w-max items-center gap-2 px-3`}>
        <Avatar img={u.avatar} frame={u.frame} size={34} />
        <UserName className="max-w-[180px] truncate text-[13px] font-black text-white" uid={u.uid} name={u.name}/>
        <VipChip vip={u.vip} />
      </div>
    </div>
  );
}
