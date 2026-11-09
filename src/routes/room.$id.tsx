import { icons3d, roomBackground } from "@/lib/assets3d";
import { UserAvatar, MediaImage } from "@/components/UserAvatar";
import { AdminAssetMedia } from "@/components/AdminAssetMedia";
import { IdentityBadges } from "@/components/IdentityBadges";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Lock, Mic, MicOff, Send, Share2, Trash2, Users, Gift, Settings, UserPlus, MessageCircle, DoorOpen, VolumeX, LogOut, Ban, Shield, Music2, Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
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

type Profile = { id: string; display_name: string; display_no?: number; id_color?: string | null; avatar_url: string | null; level: number; vip_level: number; equipped_frame?: string | null; name_color?: string | null; name_effect?: string | null; name_effect_speed?: number | null; chat_bubble_color?: string | null; chat_bubble_asset_key?: string | null; sound_wave_asset_key?: string | null; profile_card_asset_key?: string | null };
type Badge = { badge_name: string; badge_asset_key?: string | null; badge_color?: string | null; is_equipped?: boolean };
type Seat = { seat_index: number; user_id: string | null; is_locked: boolean; is_muted: boolean };
type Msg = { id: string; user_id: string; body: string; created_at: string; kind?: string };
type GiftT = { id: string; name: string; emoji: string; price: number; tier: string; category_id?: string | null; animation_style?: string; animation_speed?: number; display_duration_ms?: number; asset_key?: string | null; asset_url?: string | null };
type GiftCategoryT = { id: string; name: string; display_mode: "static" | "animated"; sort_order: number };
type LuckyGiftT = { id: string; name: string; asset_key?: string | null; price: number; win_chance: number; min_reward: number; max_reward: number };
type Room = { id: string; room_no: number; owner_id: string; name: string; description: string | null; category: string; country: string; seat_count: number; is_private?: boolean; cover_url?: string | null; mic_mode?: "request" | "direct" };

function formatMusicTime(value: number) { const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

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
  const [cosmeticUrls, setCosmeticUrls] = useState<Record<string,{bubble?:string;wave?:string;card?:string}>>({});
  const [isMod, setIsMod] = useState(false);
  const [text, setText] = useState("");
  const [seatMenu, setSeatMenu] = useState<Seat | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [gifts, setGifts] = useState<GiftT[]>([]);
  const [giftCategoriesList, setGiftCategoriesList] = useState<GiftCategoryT[]>([]);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTab, setGiftTab] = useState<"normal" | "lucky">("normal");
  const [giftCategory, setGiftCategory] = useState("all");
  const [giftTo, setGiftTo] = useState<string | null>(null);
  const [giftSel, setGiftSel] = useState<GiftT | null>(null);
  const [luckyGifts, setLuckyGifts] = useState<LuckyGiftT[]>([]);
  const [luckySel, setLuckySel] = useState<LuckyGiftT | null>(null);
  const [qty, setQty] = useState(1);
  const [coins, setCoins] = useState(0);
  const [anim, setAnim] = useState<{ key: number; emoji: string; name: string; style: string; speed: number; duration: number; mode: "static" | "animated"; width?: number; height?: number; audioEnabled: boolean; playbackSpeed: number } | null>(null);
  const [entryAnim, setEntryAnim] = useState<{ key: number; src: string; name: string; avatar: string; level: number; vip: number; width?: number; height?: number; audioEnabled: boolean; playbackSpeed: number; animationStyle: string; animationSpeed: number } | null>(null);
  const [voiceControls, setVoiceControls] = useState<{ mic_style?: string; show_mic_effect?: boolean; mic_asset_url?: string; muted_asset_url?: string; effect_asset_url?: string }>({});
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicProgress, setMusicProgress] = useState({ currentTime: 0, duration: 0, playing: false });
  const [musicVolume, setMusicVolume] = useState(100);
  const [musicCommand, setMusicCommand] = useState<{ id: number; action: "pause" | "resume" | "seek" | "volume"; value?: number } | null>(null);
  const musicCommandId = useRef(0);
  const sendMusicCommand = useCallback((action: "pause" | "resume" | "seek" | "volume", value?: number) => {
    setMusicCommand({ id: ++musicCommandId.current, action, value });
  }, []);
  const onMusicProgress = useCallback((progress: { currentTime: number; duration: number; playing: boolean }) => {
    setMusicProgress(progress);
  }, []);
  const [speakingUsers, setSpeakingUsers] = useState<string[]>([]);
  const [micRequests, setMicRequests] = useState<{ id: string; user_id: string; created_at: string }[]>([]);
  const [myMicRequest, setMyMicRequest] = useState<{ id: string } | null>(null);
  const [chatMutedUser, setChatMutedUser] = useState(false);
  const [micBlockedUser, setMicBlockedUser] = useState(false);
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
  type AssetPlaybackSettings = { display_width?: number; display_height?: number; playback_speed?: number; animation_style?: string; display_duration_ms?: number; audio_enabled?: boolean };
  async function getAssetPlaybackSettings(assetRef?: string | null): Promise<AssetPlaybackSettings> {
    if (!assetRef) return {};
    const { data: byKey } = await supabase.from("admin_assets").select("metadata").eq("asset_key", assetRef).eq("is_active", true).maybeSingle();
    if (byKey?.metadata) return byKey.metadata as AssetPlaybackSettings;

    // Older gift rows may keep a signed Storage URL instead of the stable asset_key.
    // Resolve its bucket path so the settings saved on the original admin asset are used.
    let storagePath = assetRef;
    if (/^https?:\/\//i.test(assetRef)) {
      const marker = "/storage/v1/object/";
      const markerIndex = assetRef.indexOf(marker);
      if (markerIndex >= 0) {
        const tail = assetRef.slice(markerIndex + marker.length).split("?")[0];
        const parts = tail.split("/");
        const access = parts.shift();
        const bucket = parts.shift();
        if (bucket !== "admin-assets" || !access) return {};
        try { storagePath = decodeURIComponent(parts.join("/").replace(/^\/+/, "")); }
        catch { storagePath = parts.join("/").replace(/^\/+/, ""); }
      }
    }
    if (!storagePath || storagePath === assetRef && !storagePath.includes("/")) return {};
    const { data: byPath } = await supabase.from("admin_assets").select("metadata")
      .filter("metadata->>storage_path", "eq", storagePath)
      .eq("is_active", true)
      .maybeSingle();
    return (byPath?.metadata ?? {}) as AssetPlaybackSettings;
  }
  function showGiftAnimation(image: string, config?: { style?: string; speed?: number; duration?: number; mode?: "static" | "animated"; width?: number; height?: number; audioEnabled?: boolean; playbackSpeed?: number }) {
    const token = Date.now() + Math.floor(Math.random() * 1000);
    const duration = Math.max(500, Math.min(120000, Number(config?.duration ?? 2600)));
    const speed = Math.max(0.25, Math.min(3, Number(config?.speed ?? 1)));
    const playbackSpeed = Math.max(0.25, Math.min(3, Number(config?.playbackSpeed ?? 1)));
    setAnim({ key: token, emoji: image, name: "", style: config?.style || "zoom", speed, duration, mode: config?.mode || "animated", width: config?.width, height: config?.height, audioEnabled: config?.audioEnabled !== false, playbackSpeed });
    // Still images use the configured display duration. Videos are removed by onEnded,
    // so the complete original Storage file is played without a shortened timer.
    if (!isVideoAsset(image)) window.setTimeout(() => setAnim((current) => current?.key === token ? null : current), duration);
  }
  useEffect(() => {
    let active = true;
    const refreshGiftCatalog = async () => {
      const [{ data: rows }, { data: cats }] = await Promise.all([
        supabase.from("gifts").select("id,name,emoji,price,tier,category_id,animation_style,animation_speed,display_duration_ms,asset_key,asset_url").eq("active", true).order("sort"),
        supabase.from("gift_categories").select("id,name,display_mode,sort_order").eq("is_active", true).order("sort_order"),
      ]);
      const resolved = await Promise.all((rows || []).map(async (gift) => ({
        ...gift,
        asset_url: (gift.asset_key ? await getAdminAssetUrl(gift.asset_key) : null) || (gift.asset_url ? await getAdminAssetUrl(gift.asset_url) : null),
      })));
      if (active) {
        setGifts(resolved as GiftT[]);
        setGiftCategoriesList((cats ?? []) as GiftCategoryT[]);
      }
    };
    const channel = supabase.channel(`room-gift-catalog-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gifts" }, () => { void refreshGiftCatalog(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "gift_categories" }, () => { void refreshGiftCatalog(); })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [id]);

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
      supabase.from("profiles").select("id,display_name,display_no,id_color,avatar_url,level,vip_level,equipped_frame,name_color,name_effect,name_effect_speed,chat_bubble_color,chat_bubble_asset_key,sound_wave_asset_key,profile_card_asset_key").in("id", missing),
      supabase.from("user_badges").select("user_id,badge_name,badge_asset_key,badge_color,is_equipped").in("user_id", missing).eq("is_equipped", true),
    ]);
    if (data) setProfiles((p) => ({ ...p, ...Object.fromEntries(data.map((d) => [d.id, d as Profile])) }));
    if (badgeRows) setBadges((b) => ({ ...b, ...Object.fromEntries(badgeRows.map((d) => [d.user_id, d as Badge])) }));
    const cosmeticEntries = await Promise.all((data ?? []).map(async (d) => [d.id, { bubble: d.chat_bubble_asset_key ? await getAdminAssetUrl(d.chat_bubble_asset_key) : undefined, wave: d.sound_wave_asset_key ? await getAdminAssetUrl(d.sound_wave_asset_key) : undefined, card: d.profile_card_asset_key ? await getAdminAssetUrl(d.profile_card_asset_key) : undefined }] as const));
    setCosmeticUrls((v) => ({ ...v, ...Object.fromEntries(cosmeticEntries) }));
  }, [profiles]);

  const loadSeats = useCallback(async () => {
    const { data } = await supabase.from("room_seats").select("seat_index,user_id,is_locked,is_muted").eq("room_id", id).order("seat_index");
    if (data) setSeats(normalizeSeats(data as Seat[]));
  }, [id]);
  async function playEntryFor(userId: string) {
    // Only play a room entrance that the user currently owns and has equipped
    // from the store. Never substitute a generic/default animation.
    const { data: profile } = await supabase.from("profiles")
      .select("display_name,avatar_url,level,vip_level,equipped_entry")
      .eq("id", userId).maybeSingle();
    const equippedKey = profile?.equipped_entry;
    if (!equippedKey) return;

    const { data: storeItem } = await supabase.from("store_items")
      .select("id,asset_key,kind")
      .eq("asset_key", equippedKey)
      .eq("kind", "entry")
      .maybeSingle();
    if (!storeItem?.id || storeItem.asset_key !== equippedKey) return;

    // equipped_entry is written by the equip_item RPC, which verifies ownership.
    // Do not query another user's user_items here: its owner-only RLS would hide
    // the item from other room participants and suppress their entrance effect.

    const src = await getAdminAssetUrl(storeItem.asset_key);
    if (!src) return;
    const settings = await getAssetPlaybackSettings(storeItem.asset_key);
    const token = Date.now() + Math.floor(Math.random() * 1000);
    setEntryAnim({
      key: token,
      src,
      name: profile?.display_name || "عضو",
      avatar: profile?.avatar_url || "",
      level: Number(profile?.level || 1),
      vip: Number(profile?.vip_level || 0),
      width: Number(settings.display_width) || undefined,
      height: Number(settings.display_height) || undefined,
      audioEnabled: settings.audio_enabled !== false,
      playbackSpeed: Math.max(0.25, Math.min(3, Number(settings.playback_speed ?? 1))),
      animationStyle: settings.animation_style || "zoom",
      animationSpeed: Math.max(0.25, Math.min(3, Number(settings.playback_speed ?? 1))),
    });
    if (!isVideoAsset(src)) {
      const displayDuration = Math.max(500, Math.min(120000, Number(settings.display_duration_ms ?? 5200)));
      window.setTimeout(() => setEntryAnim((current) => current?.key === token ? null : current), displayDuration);
    }
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
    let joinCompleted = false;
    let channelReady = false;
    let entryAnnounced = false;
    let ch: ReturnType<typeof supabase.channel>;
    const announceRoomEntry = async () => {
      if (!joinCompleted || !channelReady || entryAnnounced || !ch) return;
      entryAnnounced = true;
      await ch.send({ type: "broadcast", event: "member_entered", payload: { roomId: id, userId: uid, entryId: crypto.randomUUID() } });
      // The joining user sees the same equipped entrance animation as everyone else.
      void playEntryFor(uid);
    };
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
      try { const mini = JSON.parse(localStorage.getItem("vox_minimized_room") || "null") as { id?: string } | null; if (mini?.id === id) { localStorage.removeItem("vox_minimized_room"); localStorage.removeItem("vox_active_room"); localStorage.removeItem("vox_minimized_room_id"); window.dispatchEvent(new Event("vox-room-minimized")); } } catch { localStorage.removeItem("vox_minimized_room"); localStorage.removeItem("vox_active_room"); localStorage.removeItem("vox_minimized_room_id"); window.dispatchEvent(new Event("vox-room-minimized")); }
      setRoom(r as Room);
      joinCompleted = true;
      void announceRoomEntry();
      const { data: m } = await supabase.from("room_moderators").select("user_id").eq("room_id", id).eq("user_id", uid);
      setIsMod(!!m?.length);
      loadSeats();
      loadMembers();
      loadMicRequests();
      // Room chat is live-session only: never replay persisted messages on entry.
    })();
    ch = supabase
      .channel(`room-${id}`)
      .on("broadcast", { event: "chat_message" }, (payload) => {
        const message = payload.payload as Msg & { roomId?: string };
        if (message.roomId !== id || !message.id) return;
        setMsgs((current) => current.some((m) => m.id === message.id) ? current : [...current.slice(-99), message]);
      })
      .on("broadcast", { event: "gift_sent" }, async (payload) => {
        const event = payload.payload as { roomId?: string; giftId?: string; eventId?: string; lucky?: boolean };
        if (event.roomId !== id || !event.giftId) return;
        if (event.lucky) {
          const { data: lucky } = await supabase.from("lucky_gifts").select("asset_key").eq("id", event.giftId).maybeSingle();
          const image = lucky?.asset_key ? await getAdminAssetUrl(lucky.asset_key) : null;
          const settings = await getAssetPlaybackSettings(lucky?.asset_key);
          if (image) showGiftAnimation(image, { style: settings.animation_style, speed: settings.playback_speed, playbackSpeed: settings.playback_speed, duration: settings.display_duration_ms, width: settings.display_width, height: settings.display_height, audioEnabled: settings.audio_enabled });
          return;
        }
        const { data: g } = await supabase.from("gifts").select("name,emoji,asset_key,asset_url,category_id,animation_style,animation_speed,display_duration_ms").eq("id", event.giftId).maybeSingle();
        if (!g) return;
        const assetRef = g.asset_key || g.asset_url;
        const image = (g.asset_key ? await getAdminAssetUrl(g.asset_key) : null) || (g.asset_url ? await getAdminAssetUrl(g.asset_url) : null);
        const settings = await getAssetPlaybackSettings(assetRef);
        const { data: category } = g.category_id ? await supabase.from("gift_categories").select("display_mode").eq("id",g.category_id).maybeSingle() : { data: null };
        if (image) showGiftAnimation(image,{style:g.animation_style || settings.animation_style,speed:g.animation_speed || settings.playback_speed,playbackSpeed:settings.playback_speed,duration:settings.display_duration_ms || g.display_duration_ms,mode:category?.display_mode || "animated",width:settings.display_width,height:settings.display_height,audioEnabled:settings.audio_enabled});
      })
      .on("broadcast", { event: "member_entered" }, async (payload) => {
        const event = payload.payload as { roomId?: string; userId?: string };
        if (event.roomId !== id || !event.userId || event.userId === uid) return;
        await ensureProfiles([event.userId]);
        void playEntryFor(event.userId);
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
        // The broadcast also handles re-entry when the membership row already exists.
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
        channelReady = true;
        void announceRoomEntry();
        void Promise.all([loadSeats(), loadMembers(), loadMicRequests()]);
        setMsgs([]); // New subscription starts with an empty live chat.
      }
    });
    roomLive.current = ch;
    const loadCatalog = async () => {
      const [{ data: rows }, { data: lucky }, { data: cats }] = await Promise.all([
        supabase.from("gifts").select("id,name,emoji,price,tier,category_id,animation_style,animation_speed,display_duration_ms,asset_key,asset_url").eq("active", true).order("sort"),
        supabase.from("lucky_gifts").select("id,name,asset_key,price,win_chance,min_reward,max_reward").eq("active",true).order("sort_order"),
        supabase.from("gift_categories").select("id,name,display_mode,sort_order").eq("is_active",true).order("sort_order"),
      ]);
      const resolved = await Promise.all((rows || []).map(async (g) => ({
        ...g,
        // Always resolve the exact admin-uploaded file from its stable asset_key.
        // Do not fall back to the generic gift box when an uploaded asset exists.
        asset_url: (g.asset_key ? await getAdminAssetUrl(g.asset_key) : null) || (g.asset_url ? await getAdminAssetUrl(g.asset_url) : null),
      })));
      setGifts(resolved as GiftT[]); setLuckyGifts((lucky ?? []) as LuckyGiftT[]); setGiftCategoriesList((cats ?? []) as GiftCategoryT[]);
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
      // Keep server membership and Agora alive when the user minimizes the room
      // and navigates to another screen. The floating mini-room restores it later.
      let isMinimized = false;
      try { const mini = JSON.parse(localStorage.getItem("vox_minimized_room") || "null") as { id?: string } | null; isMinimized = mini?.id === id; } catch { /* invalid marker: leave normally */ }
      if (!isMinimized) {
        // Defer leaving so a quick remount/reconnect cannot remove the fresh membership.
        const timer = setTimeout(() => {
          pendingRoomLeaves.delete(id);
          void supabase.rpc("leave_room", { _room: id });
        }, 1000);
        pendingRoomLeaves.set(id, timer);
      }
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
    if (!room || !members.length || members.includes(uid)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void supabase.from("room_members").select("user_id").eq("room_id", id).eq("user_id", uid).maybeSingle()
        .then(({ data, error }) => {
          if (active && !error && !data) {
            nav({ to: "/" });
          }
        });
    }, 700);
    return () => { active = false; window.clearTimeout(timer); };
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
      // Refresh authoritative room membership and the fixed seat layout after a kick.
      await Promise.all([loadMembers(), syncRoomSeats(), loadSeats()]);
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
    setMicBlockedUser(false);
    setTargetIsModerator(false);
    if (s.user_id) void openUserCard(s.user_id);
    if (isStaff && s.user_id && s.user_id !== uid) {
      const [muteResult, micResult, modResult] = await Promise.all([
        supabase.rpc("staff_is_chat_muted", { _room: id, _user: s.user_id }),
        supabase.rpc("staff_is_mic_blocked", { _room: id, _user: s.user_id }),
        supabase.from("room_moderators").select("user_id").eq("room_id", id).eq("user_id", s.user_id).maybeSingle(),
      ]);
      if (!muteResult.error) setChatMutedUser(!!muteResult.data);
      if (!micResult.error) setMicBlockedUser(!!micResult.data);
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

  async function toggleFollow(target?: string) { if (!target || target === uid) return; const { data: existing } = await supabase.from("follows").select("follower_id,following_id").eq("follower_id", uid).eq("following_id", target).maybeSingle(); if (existing) { const { error } = await supabase.from("follows").delete().eq("follower_id", uid).eq("following_id", target); if (error) toast.error(errMsg(error)); else { setFollowing(false); toast.success("تم إلغاء المتابعة"); } } else { const { error } = await supabase.from("follows").upsert({ follower_id: uid, following_id: target }, { onConflict: "follower_id,following_id", ignoreDuplicates: true }); if (error) toast.error(errMsg(error)); else { setFollowing(true); toast.success("تمت المتابعة"); } } }

  async function openGifts(target?: string) {
    const { data } = await supabase.from("wallets").select("coins").eq("user_id", uid).maybeSingle();
    setCoins(Number(data?.coins ?? 0));
    const others = members.filter((m) => m !== uid);
    setGiftTo(target ?? seats.find((s) => s.user_id && s.user_id !== uid)?.user_id ?? others[0] ?? null);
    setGiftSel(null);
    setLuckySel(null);
    setGiftTab("normal");
    setGiftCategory("all");
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
    const giftAssetRef = giftSel.asset_key || giftSel.asset_url;
    const giftAssetUrl = giftAssetRef ? await getAdminAssetUrl(giftAssetRef) : null;
    const giftAssetSettings = await getAssetPlaybackSettings(giftAssetRef);
    if (giftAssetUrl) showGiftAnimation(giftAssetUrl,{style:giftSel.animation_style || giftAssetSettings.animation_style,speed:giftSel.animation_speed || giftAssetSettings.playback_speed,playbackSpeed:giftAssetSettings.playback_speed,duration:giftAssetSettings.display_duration_ms || giftSel.display_duration_ms,mode:giftCategoriesList.find(x=>x.id===giftSel.category_id)?.display_mode || "animated",width:giftAssetSettings.display_width,height:giftAssetSettings.display_height,audioEnabled:giftAssetSettings.audio_enabled});
    await roomLive.current?.send({ type: "broadcast", event: "gift_sent", payload: { roomId: id, giftId: giftSel.id, eventId: crypto.randomUUID(), receiverId: giftTo, quantity: qty } });
    setGiftOpen(false);
  }

  async function sendLuckyGift() {
    if (!luckySel || !giftTo) return;
    const { data, error } = await supabase.rpc("send_lucky_gift", { _gift: luckySel.id, _receiver: giftTo, _room: id, _qty: qty });
    if (error) { toast.error(errMsg(error)); return; }
    setCoins(c => c - luckySel.price * qty);
    if (data?.won) toast.success(`🎉 فاز المستخدم بمردود ${Number(data.reward).toLocaleString()} عملة`); else toast.success("تم إرسال هدية الحظ — هذه المرة بدون مردود");
    await roomLive.current?.send({ type: "broadcast", event: "gift_sent", payload: { roomId: id, giftId: luckySel.id, eventId: crypto.randomUUID(), receiverId: giftTo, quantity: qty, lucky: true } });
    const luckyAsset = luckySel.asset_key ? await getAdminAssetUrl(luckySel.asset_key) : null;
    const luckySettings = await getAssetPlaybackSettings(luckySel.asset_key);
    if (luckyAsset) showGiftAnimation(luckyAsset,{style:luckySettings.animation_style,speed:luckySettings.playback_speed,playbackSpeed:luckySettings.playback_speed,duration:luckySettings.display_duration_ms,width:luckySettings.display_width,height:luckySettings.display_height,audioEnabled:luckySettings.audio_enabled});
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
  const giftCategories = giftCategoriesList;
  const visibleGifts = giftCategory === "all" ? gifts : gifts.filter((gift) => gift.category_id === giftCategory);

  return (
    <>{!roomMinimized && <RoomVoice roomId={id} uid={uid} members={members} micEnabled={myMicEnabled && micPermissionGranted} musicFile={musicFile} musicCommand={musicCommand} onMusicProgress={onMusicProgress} onSpeakingUsers={handleSpeakingUsers} />}
    <input id="room-music-file" type="file" accept="audio/*" className="hidden" onChange={(e) => {
      const file = e.target.files?.[0] ?? null;
      e.currentTarget.value = "";
      if (!file) return;
      if (!myMicEnabled || !micPermissionGranted) { toast.error("يجب أن تكون على الميك أولاً حتى يسمع الجميع الأغنية"); return; }
      setMusicProgress({ currentTime: 0, duration: 0, playing: true });
      setMusicFile(file);
      setMusicOpen(true);
    }} />
    {myMicEnabled && micPermissionGranted && <Button type="button" onClick={() => setMusicOpen(true)} className="fixed bottom-24 left-4 z-[95] h-14 w-14 rounded-full border border-gold/50 bg-gold text-black shadow-2xl" aria-label="مشغل الموسيقى" title="مشغل الموسيقى"><Music2 className="h-6 w-6" />{musicFile && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />}</Button>}
    <Sheet open={musicOpen} onOpenChange={setMusicOpen}>
      <SheetContent side="bottom" dir="rtl" className="rounded-t-3xl border-gold/20">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Music2 className="h-5 w-5 text-gold" /> مشغل موسيقى الغرفة</SheetTitle></SheetHeader>
        <div className="space-y-4 p-4">
          <div className="rounded-2xl border border-primary/20 bg-secondary/40 p-3">
            <div className="truncate text-sm font-bold">{musicFile?.name ?? "لم يتم اختيار أغنية بعد"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{musicFile ? "يتم بث الصوت للموجودين في الغرفة عبر Agora" : "اختر ملفاً صوتياً من جهازك لتشغيله للجميع"}</div>
            <label htmlFor="room-music-file" className="mt-3 flex cursor-pointer items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-bold text-black">{musicFile ? "تغيير الأغنية" : "اختيار أغنية من الجهاز"}</label>
          </div>
          {musicFile && <>
            <div className="flex items-center justify-center gap-3">
              <Button type="button" variant="outline" size="icon" onClick={() => sendMusicCommand("seek", Math.max(0, musicProgress.currentTime - 10))} aria-label="رجوع 10 ثوان"><SkipBack className="h-5 w-5" /></Button>
              <Button type="button" className="h-12 w-12 rounded-full bg-gold text-black" onClick={() => sendMusicCommand(musicProgress.playing ? "pause" : "resume")} aria-label={musicProgress.playing ? "إيقاف مؤقت" : "استكمال التشغيل"}>{musicProgress.playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}</Button>
              <Button type="button" variant="outline" size="icon" onClick={() => sendMusicCommand("seek", Math.min(musicProgress.duration, musicProgress.currentTime + 10))} aria-label="تقديم 10 ثوان"><SkipForward className="h-5 w-5" /></Button>
            </div>
            <div className="space-y-1">
              <input aria-label="تقديم أو إرجاع الأغنية" type="range" min="0" max={Math.max(1, musicProgress.duration)} step="0.5" value={Math.min(musicProgress.currentTime, musicProgress.duration || 0)} onChange={(e) => sendMusicCommand("seek", Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
              <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground" dir="ltr"><span>{formatMusicTime(musicProgress.currentTime)}</span><span>{formatMusicTime(musicProgress.duration)}</span></div>
            </div>
            <div className="flex items-center gap-3"><Volume2 className="h-5 w-5 shrink-0 text-gold" /><input aria-label="مستوى صوت بث الأغنية" type="range" min="0" max="100" value={musicVolume} onChange={(e) => { const next = Number(e.target.value); setMusicVolume(next); sendMusicCommand("volume", next); }} className="w-full accent-[hsl(var(--primary))]" /><span className="w-10 text-left text-xs tabular-nums">{musicVolume}%</span></div>
            <Button type="button" variant="destructive" className="w-full" onClick={() => { setMusicFile(null); setMusicProgress({ currentTime: 0, duration: 0, playing: false }); }}>إيقاف الأغنية وإزالة الملف</Button>
          </>}
          <p className="text-center text-[11px] text-muted-foreground">البث متاح فقط أثناء وجودك على الميكروفون.</p>
        </div>
      </SheetContent>
    </Sheet>
    {roomMinimized ? (
      <>
        <AppShell>
          <HomeScreen />
        </AppShell>
      </>
    ) : <div className="room-scene mx-auto flex h-dvh max-w-2xl flex-col">
      <MediaImage src={roomBackground(room.category)} className="room-scenery" />
      <header className="glass m-3 flex items-center gap-3 rounded-2xl p-3">
        <Button variant="ghost" size="icon" onClick={() => setExitPrompt(true)} aria-label="رجوع" title="رجوع"><img src={icons3d.back} alt="" className="h-7 w-7 rotate-180 object-contain" /></Button>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <AdminAssetMedia src={roomCoverUrl || roomBackground(room.category)} alt={`صورة ${room.name}`} className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-primary/40" />
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
                {p ? <UserAvatar src={p.avatar_url} name={p.display_name} vip={p.vip_level} size={72} frameKey={p.equipped_frame} /> : <AdminAssetMedia src={s.is_locked ? icons3d.micLocked : voiceControls.mic_asset_url || (s.seat_index === 0 ? icons3d.micHost : icons3d.mic)} className="h-20 w-20 object-contain" />}
                {p && <AdminAssetMedia src={s.is_muted ? voiceControls.muted_asset_url || icons3d.micMuted : voiceControls.mic_asset_url || (host ? icons3d.micHost : icons3d.mic)} alt={s.is_muted ? "مكتوم" : "على المقعد"} className={`absolute -bottom-1 -left-1 h-7 w-7 object-contain ${!s.is_muted && speakingUsers.includes(s.user_id!) ? "speaker-mic-pulse" : ""}`} videoClassName={`absolute -bottom-1 -left-1 h-7 w-7 object-contain ${!s.is_muted && speakingUsers.includes(s.user_id!) ? "speaker-mic-pulse" : ""}`} />}
                {p && cosmeticUrls[p.id]?.wave && <AdminAssetMedia src={cosmeticUrls[p.id]!.wave} className="pointer-events-none absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] object-contain opacity-90" />}{p && voiceControls.show_mic_effect && voiceControls.effect_asset_url && <AdminAssetMedia src={voiceControls.effect_asset_url} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
              </div>
              <span className={`max-w-24 truncate text-xs font-bold ${p?.name_effect && p.name_effect !== "none" ? `name-effect-${p.name_effect}` : ""}`} style={{ color: p?.name_color || undefined, animationDuration: `${p?.name_effect_speed || 1800}ms` }}>{p ? p.display_name : s.seat_index + 1}</span>{p?.display_no && <span className="text-[10px] font-bold" style={{ color: p.id_color || "#D4AF37" }}>ID {p.display_no}</span>}{p && badges[p.id] && <IdentityBadges badge={badges[p.id]} />}
            </Button>
          );
        })}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4">
        <div className="rounded-xl bg-secondary/60 p-2 text-xs text-primary">📢 مرحباً بك في {room.name}. {room.description}</div>
        {msgs.map((m) => (
          <div key={m.id} className={`relative isolate w-fit max-w-[85%] overflow-hidden rounded-2xl px-3 py-1.5 text-sm ${m.kind === "gift" ? "bg-gold font-bold" : "glass"}`} style={{ backgroundColor: m.kind === "gift" ? undefined : profiles[m.user_id]?.chat_bubble_color || undefined }}>
            {m.kind !== "gift" && cosmeticUrls[m.user_id]?.bubble && <AdminAssetMedia src={cosmeticUrls[m.user_id]!.bubble} className="pointer-events-none absolute inset-0 z-0 h-full w-full object-fill opacity-90" />}
            <span className="relative z-10"><button type="button" className="font-bold" style={{ color: profiles[m.user_id]?.name_color || undefined }} onClick={() => void openUserCard(m.user_id)}>{publicName(m.user_id)}: </button>{m.body}</span>
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
              {isStaff && (
                <>
                  {seatMenu.seat_index >= 0 && <>
                    <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: seatMenu.is_locked ? "unlock" : "lock" })}>{seatMenu.is_locked ? "فتح المايك" : "قفل المايك"}</Button>
                    <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: seatMenu.is_muted ? "unmute" : "mute" })}>{seatMenu.is_muted ? "إلغاء الكتم" : "كتم المايك"}</Button>
                    {seatMenu.user_id && seatMenu.user_id !== uid && <Button variant="outline" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: "kick_seat" })}>إنزال من المايك</Button>}
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
               {seatMenu.user_id && profiles[seatMenu.user_id] && <div className="relative mx-relative w-full max-w-sm overflow-hidden rounded-[28px] border border-amber-300/40 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-4 text-right text-white shadow-[0_18px_55px_rgba(0,0,0,.55)] ring-1 ring-amber-200/15" dir="rtl">{seatMenu.user_id && cosmeticUrls[seatMenu.user_id]?.card && <AdminAssetMedia src={cosmeticUrls[seatMenu.user_id]!.card} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25" />}<div className="relative">
  <div className="mb-2 flex items-center justify-between"><span className="rounded-full border border-amber-200/30 bg-black/20 px-2 py-1 text-[10px] font-bold text-amber-200">بطاقة تعريف المستخدم</span><span className="text-[10px] font-black tracking-widest text-amber-100">PROFILE</span></div>
  <div className="flex items-center gap-3">
    <button type="button" onClick={() => nav({ to: "/u/$id", params: { id: seatMenu.user_id! } })} className="shrink-0 rounded-full ring-2 ring-primary/40 shadow-gold"><UserAvatar src={profiles[seatMenu.user_id]?.avatar_url} name={profiles[seatMenu.user_id]?.display_name || "مستخدم"} vip={profiles[seatMenu.user_id]?.vip_level} size={68} frameKey={profiles[seatMenu.user_id]?.equipped_frame} /></button>
    <div className="min-w-0 flex-1">
      <button type="button" onClick={() => nav({ to: "/u/$id", params: { id: seatMenu.user_id! } })} className="max-w-full truncate text-right text-base font-bold" style={{ color: profiles[seatMenu.user_id]?.name_color || undefined }}>{profiles[seatMenu.user_id]?.display_name}</button>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] font-black"><span className="rounded-full border border-amber-200/25 bg-black/25 px-2 py-0.5 text-amber-100">ID {profiles[seatMenu.user_id]?.display_no}</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-white/90">Lv.{profiles[seatMenu.user_id]?.level ?? 1}</span>{(profiles[seatMenu.user_id]?.vip_level ?? 0) > 0 && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-amber-200">VIP {profiles[seatMenu.user_id]?.vip_level}</span>}</div>
      {badges[seatMenu.user_id] && <div className="mt-1"><IdentityBadges badge={badges[seatMenu.user_id]} /></div>}
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
    <Button size="sm" variant="outline" title={micBlockedUser ? "فك كتم المايك" : "كتم المايك"} onClick={() => call("staff_set_mic_access", { _room: id, _user: seatMenu.user_id!, _blocked: !micBlockedUser })}><VolumeX className="h-4 w-4" /></Button>
    <Button size="sm" variant="outline" title="إنزال من المايك" onClick={() => call("staff_seat_action", { _room: id, _seat: seatMenu.seat_index, _action: "kick_seat" })}><Ban className="h-4 w-4" /></Button>
    {isOwner && <Button size="sm" variant="outline" title={targetIsModerator ? "إزالة الأدمن" : "إضافة أدمن"} onClick={() => call("staff_set_room_moderator", { _room: id, _user: seatMenu.user_id!, _enabled: !targetIsModerator })}><UserPlus className="h-4 w-4" /></Button>}
  </div>}
</div></div>}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {exitPrompt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-5" dir="rtl">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-primary/30 bg-background p-5 shadow-2xl">
            <div className="text-center text-lg font-bold">ماذا تريد أن تفعل؟</div>
            <Button className="w-full" onClick={() => { localStorage.setItem("vox_minimized_room", JSON.stringify({ id, name: room.name, category: room.category, cover_url: room.cover_url })); localStorage.setItem("vox_active_room", JSON.stringify({ id, name: room.name, cover: room.cover_url, micEnabled: myMicEnabled && micPermissionGranted })); localStorage.setItem("vox_minimized_room_id", id); window.dispatchEvent(new Event("vox-room-minimized")); setExitPrompt(false); setRoomMinimized(true); }}>تصغير الغرفة</Button>
            <Button variant="destructive" className="w-full" disabled={isLeavingRoom} onClick={async () => {
              setIsLeavingRoom(true);
              localStorage.removeItem("vox_minimized_room");
              window.dispatchEvent(new Event("vox-room-minimized"));
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
        <>
          <style>{`@keyframes entry-zoom{0%{opacity:0;transform:scale(.35)}70%{opacity:1;transform:scale(1.04)}100%{transform:scale(1)}}@keyframes entry-slide{0%{opacity:0;transform:translateX(80vw)}100%{opacity:1;transform:translateX(0)}}@keyframes entry-float{0%{opacity:0;transform:translateY(45px)}100%{opacity:1;transform:translateY(0)}}@keyframes entry-pulse{0%{opacity:0;transform:scale(.7)}60%{opacity:1;transform:scale(1.08)}100%{transform:scale(1)}}`}</style>
          <div key={entryAnim.key} role="status" aria-live="polite" className="pointer-events-auto fixed inset-0 z-[75] flex items-center justify-center overflow-hidden bg-black/95">
            <button type="button" onClick={() => setEntryAnim(null)} className="absolute right-4 top-4 z-[90] rounded-full border border-white/30 bg-black/75 px-4 py-2 text-xs font-bold text-white">إغلاق</button>
            <div className="flex h-full w-full items-center justify-center overflow-hidden">
              {isVideoAsset(entryAnim.src) ? (
                <video
                  key={entryAnim.key}
                  src={entryAnim.src}
                  autoPlay
                  controls
                  muted={!entryAnim.audioEnabled}
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    e.currentTarget.playbackRate = entryAnim.playbackSpeed;
                    e.currentTarget.volume = entryAnim.audioEnabled ? 1 : 0;
                    void e.currentTarget.play().catch(() => { /* WebView may require a tap before audio playback. */ });
                  }}
                  onCanPlay={(e) => {
                    if (entryAnim.audioEnabled) void e.currentTarget.play().catch(() => {});
                  }}
                  onEnded={() => setEntryAnim((current) => current?.key === entryAnim.key ? null : current)}
                  onError={() => setEntryAnim((current) => current?.key === entryAnim.key ? null : current)}
                  style={{ animation: entryAnim.animationStyle === "none" ? "none" : `entry-${["slide","float","pulse"].includes(entryAnim.animationStyle) ? entryAnim.animationStyle : "zoom"} ${Math.max(250, 900 / entryAnim.animationSpeed)}ms ease-out both` }}
                  className="block h-auto w-auto max-h-[100dvh] max-w-[100vw] object-contain"
                />
              ) : (
                <img
                  src={entryAnim.src}
                  alt="دخولية المستخدم"
                  onError={() => setEntryAnim((current) => current?.key === entryAnim.key ? null : current)}
                  style={{ animation: entryAnim.animationStyle === "none" ? "none" : `entry-${["slide","float","pulse"].includes(entryAnim.animationStyle) ? entryAnim.animationStyle : "zoom"} ${Math.max(250, 900 / entryAnim.animationSpeed)}ms ease-out both` }}
                  className="block h-auto w-auto max-h-[100dvh] max-w-[100vw] object-contain"
                />
              )}
            </div>
          </div>
        </>
      )}

      {anim && (
        <>
        <style>{`@keyframes gift-zoom{0%{opacity:0;transform:scale(.35)}70%{opacity:1;transform:scale(1.06)}100%{transform:scale(1)}}@keyframes gift-slide{0%{opacity:0;transform:translateX(90vw) scale(.8)}100%{opacity:1;transform:translateX(0) scale(1)}}@keyframes gift-float{0%{opacity:0;transform:translateY(55px) scale(.8)}55%{opacity:1;transform:translateY(-12px) scale(1.04)}100%{transform:translateY(0) scale(1)}}@keyframes gift-pulse{0%{opacity:0;transform:scale(.65)}55%{opacity:1;transform:scale(1.12)}100%{transform:scale(1)}}`}</style>
        <div key={anim.key} role="presentation" className={`pointer-events-auto fixed inset-0 z-[80] flex items-center justify-center px-5 ${anim.mode === "animated" ? "bg-black/35" : "bg-black/15"}`}>
          <button type="button" onClick={() => setAnim(null)} className="absolute right-4 top-4 z-[90] rounded-full border border-white/25 bg-black/70 px-4 py-2 text-xs font-bold text-white">إغلاق الهدية</button>
          <div className="relative flex max-h-[82vh] max-w-[92vw] items-center justify-center rounded-3xl border border-amber-200/30 bg-gradient-to-br from-slate-950/55 via-violet-950/25 to-slate-950/55 p-3 shadow-[0_0_55px_rgba(168,85,247,.28)]" style={{animation:anim.mode==="static" || anim.style==="none"?"none":`${anim.style==="slide"?"gift-slide":anim.style==="float"?"gift-float":anim.style==="pulse"?"gift-pulse":"gift-zoom"} ${Math.max(250,900/anim.speed)}ms ease-out both`, width:anim.width? `${anim.width}px` : undefined, height:anim.height? `${anim.height}px` : undefined}}>
            {isVideoAsset(anim.emoji) ? <video key={anim.key} src={anim.emoji} autoPlay controls muted={!anim.audioEnabled} playsInline preload="auto" volume={anim.audioEnabled ? 1 : 0} onLoadedMetadata={(e) => { e.currentTarget.playbackRate = anim.playbackSpeed; e.currentTarget.volume = anim.audioEnabled ? 1 : 0; void e.currentTarget.play().catch(() => { /* WebView/browser may require a user gesture for unmuted autoplay. */ }); }} onCanPlay={(e) => { if (anim.audioEnabled) void e.currentTarget.play().catch(() => {}); }} onEnded={() => setAnim((current) => current?.key === anim.key ? null : current)} onError={() => setAnim((current) => current?.key === anim.key ? null : current)} className="max-h-[72vh] max-w-[88vw] object-contain drop-shadow-2xl" /> : <img src={anim.emoji} alt="" aria-hidden="true" className="max-h-[72vh] max-w-[88vw] object-contain drop-shadow-2xl" />}
          </div>
        </div>
        </>
      )}

      <Sheet open={giftOpen} onOpenChange={setGiftOpen}>
        <SheetContent side="bottom" dir="rtl" className="max-h-[80vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle className="flex justify-between"><span>الهدايا</span><span className="text-primary">🪙 {coins}</span></SheetTitle></SheetHeader>
          <div className="space-y-3 p-4">
            <select className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" value={giftTo ?? ""} onChange={(e) => setGiftTo(e.target.value)}>
              {members.filter((m) => m !== uid).length === 0 && <option value="">لا يوجد أحد غيرك في الغرفة</option>}
              {members.filter((m) => m !== uid).map((m) => <option key={m} value={m}>إلى: {publicName(m)}</option>)}
            </select>
            <div className="flex gap-2 overflow-x-auto pb-2" dir="rtl">
              <Button type="button" size="sm" variant={giftTab === "normal" ? "default" : "outline"} className="shrink-0 rounded-full" onClick={() => setGiftTab("normal")}>الهدايا العادية</Button>
              <Button type="button" size="sm" variant={giftTab === "lucky" ? "default" : "outline"} className="shrink-0 rounded-full" onClick={() => setGiftTab("lucky")}>هدايا الحظ</Button>
            </div>
            {giftTab === "normal" ? <>
              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2" dir="rtl" style={{scrollbarWidth:"none"}}>
                <Button type="button" size="sm" variant={giftCategory === "all" ? "default" : "outline"} className="shrink-0 snap-start rounded-full" onClick={() => setGiftCategory("all")}>الكل</Button>
                {giftCategories.map((category) => <Button type="button" size="sm" variant={giftCategory === category.id ? "default" : "outline"} className="shrink-0 snap-start rounded-full" key={category.id} onClick={() => setGiftCategory(category.id)}>{category.name}{category.display_mode==="animated"?" ✨":" ·"}</Button>)}
              </div>
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3" dir="rtl" style={{scrollbarWidth:"none"}}>
              {visibleGifts.map((g) => (
                <Button variant="ghost" key={g.id} onClick={() => setGiftSel(g)} className={`h-auto w-28 shrink-0 snap-start flex-col gap-1 rounded-xl p-2 ${giftSel?.id === g.id ? "bg-secondary ring-2 ring-primary" : "glass"}`}>
                  {g.asset_url ? (isVideoAsset(g.asset_url) ? <video src={g.asset_url} autoPlay muted loop playsInline className="h-16 w-16 object-contain" /> : <img src={g.asset_url} alt={g.name} className="h-16 w-16 object-contain" />) : <span className="grid h-16 w-16 place-items-center rounded-xl bg-secondary text-muted-foreground"><Gift className="h-7 w-7" /></span>}
                  <span className="text-xs">{g.name}</span>
                  <span className="text-xs text-primary">🪙{g.price}</span>
                </Button>
              ))}
              </div>
            </> : <div className="grid grid-cols-3 gap-2">{luckyGifts.map(g=><Button variant="ghost" key={g.id} onClick={()=>{setLuckySel(g);setGiftSel(null);}} className={`h-auto flex-col gap-1 rounded-xl p-2 ${luckySel?.id===g.id?"bg-secondary ring-2 ring-gold":"glass"}`}><div className="h-14 w-14 rounded-xl bg-secondary grid place-items-center text-2xl">🎲</div><span className="text-xs">{g.name}</span><span className="text-[10px] text-gold">حظ {g.win_chance}% · 🪙{g.price}</span></Button>)}</div>}\n            <div className="flex items-center gap-2">\n              {[1, 10, 99].map((n) => <Button variant="ghost" size="sm" key={n} onClick={() => setQty(n)} className={`rounded-full ${qty === n ? "bg-gold" : "glass"}`}>x{n}</Button>)}
              <Button disabled={(!giftSel && !luckySel) || !giftTo} onClick={luckySel ? sendLuckyGift : sendGift} className="mr-auto bg-gold font-bold">{luckySel ? `إرسال حظ (${luckySel.price * qty})` : `إرسال ${giftSel ? `(${giftSel.price * qty})` : ""}`}</Button>
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

