import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = { roomId: string; uid: string; members: string[]; micEnabled: boolean; onSpeakingUsers?: (users: string[]) => void };
type TokenResponse = { appId: string; channel: string; uid: number; token: string; role: "publisher" | "subscriber"; expiresAt: number };

type VoiceSession = {
  client: IAgoraRTCClient;
  mic: IMicrophoneAudioTrack | null;
  joined: boolean;
  published: boolean;
  role: "host" | "audience";
  members: string[];
  micEnabled: boolean;
  callback?: (users: string[]) => void;
  operation: Promise<void>;
};

const sessions = new Map<string, VoiceSession>();

function numericRtcUid(userId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 1) || 1;
}

async function getToken(roomId: string): Promise<TokenResponse> {
  const { data, error } = await supabase.functions.invoke("agora-rtc-token", { body: { roomId } });
  if (error) throw error;
  if (!data?.token || !data?.appId || !data?.channel || !data?.uid) throw new Error(data?.error || "تعذر الحصول على رمز Agora");
  return data as TokenResponse;
}

async function applyMic(session: VoiceSession) {
  if (!session.joined) return;
  const access = await getToken(sessionKeyRoom(session));
  await session.client.renewToken(access.token);
  const nextRole = access.role === "publisher" ? "host" : "audience";
  if (session.role !== nextRole) {
    await session.client.setClientRole(nextRole);
    session.role = nextRole;
  }
  if (session.micEnabled) {
    if (nextRole !== "host") throw new Error("انتظر موافقة صاحب الغرفة للصعود إلى الميك");
    if (!session.mic) {
      session.mic = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "speech_low_quality",
        AEC: true,
        ANS: true,
        AGC: true,
      });
    }
    await session.mic.setEnabled(true);
    if (!session.published) {
      await session.client.publish(session.mic);
      session.published = true;
    }
  } else {
    if (session.published && session.mic) {
      await session.client.unpublish(session.mic).catch(() => undefined);
      session.published = false;
    }
    if (session.mic) await session.mic.setEnabled(false);
  }
}

function sessionKeyRoom(session: VoiceSession): string {
  return (session as VoiceSession & { roomId: string }).roomId;
}

async function destroySession(roomId: string) {
  const session = sessions.get(roomId);
  if (!session) return;
  sessions.delete(roomId);
  session.client.removeAllListeners();
  if (session.mic) {
    session.mic.stop();
    session.mic.close();
    session.mic = null;
  }
  session.joined = false;
  session.published = false;
  await session.client.leave().catch(() => undefined);
}

export function RoomVoice({ roomId, uid, members, micEnabled, onSpeakingUsers }: Props) {
  const callbackRef = useRef(onSpeakingUsers);
  callbackRef.current = onSpeakingUsers;
  const micRef = useRef(micEnabled);
  micRef.current = micEnabled;
  const membersRef = useRef(members);
  membersRef.current = members;

  useEffect(() => {
    let alive = true;
    let session = sessions.get(roomId);

    if (session) {
      session.callback = (users) => callbackRef.current?.(users);
      session.members = members;
      session.micEnabled = micEnabled;
      return () => {
        session!.callback = undefined;
        if (!sessionStorage.getItem("vox_minimized_room_id")) void destroySession(roomId);
      };
    }

    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    session = {
      roomId,
      client,
      mic: null,
      joined: false,
      published: false,
      role: "audience",
      members: membersRef.current,
      micEnabled: micRef.current,
      callback: (users) => callbackRef.current?.(users),
      operation: Promise.resolve(),
    } as VoiceSession & { roomId: string };
    sessions.set(roomId, session);

    const rtcToUser = new Map<number, string>();
    const rebuildMap = () => {
      rtcToUser.clear();
      membersRef.current.forEach((memberId) => rtcToUser.set(numericRtcUid(memberId), memberId));
      rtcToUser.set(numericRtcUid(uid), uid);
    };
    rebuildMap();

    const serialize = (task: () => Promise<void>) => {
      session!.operation = session!.operation.then(task).catch((error) => {
        if (alive) toast.error(error instanceof Error ? error.message : "تعذر تشغيل الصوت");
      });
      return session!.operation;
    };

    const onUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      if (mediaType !== "audio") return;
      await client.subscribe(user, mediaType).catch(() => undefined);
      user.audioTrack?.play();
    };
    const onUserUnpublished = (user: IAgoraRTCRemoteUser) => user.audioTrack?.stop();

    client.on("user-published", onUserPublished);
    client.on("user-unpublished", onUserUnpublished);
    client.enableAudioVolumeIndicator();
    client.on("volume-indicator", (speakers) => {
      rebuildMap();
      const active = speakers
        .filter((speaker) => speaker.level >= 18)
        .map((speaker) => rtcToUser.get(Number(speaker.uid)))
        .filter((id): id is string => !!id);
      session!.callback?.([...new Set(active)]);
    });

    const start = async () => {
      try {
        const access = await getToken(roomId);
        await client.setClientRole(access.role === "publisher" ? "host" : "audience");
        session!.role = access.role === "publisher" ? "host" : "audience";
        await client.join(access.appId, access.channel, access.token, access.uid);
        session!.joined = true;
        await applyMic(session!);
      } catch (error) {
        if (alive) toast.error(error instanceof Error ? error.message : "فشل الاتصال بخدمة الصوت");
      }
    };
    void start();

    const refresh = () => serialize(async () => {
      const access = await getToken(roomId);
      await client.renewToken(access.token);
      const nextRole = access.role === "publisher" ? "host" : "audience";
      if (session!.role !== nextRole) {
        await client.setClientRole(nextRole);
        session!.role = nextRole;
      }
      if (session!.micEnabled !== micRef.current) {
        session!.micEnabled = micRef.current;
        await applyMic(session!);
      }
    });
    client.on("token-privilege-will-expire", refresh);

    return () => {
      alive = false;
      session!.callback = undefined;
      // Keep the Agora client and microphone alive while the room is minimized.
      if (!sessionStorage.getItem("vox_minimized_room_id")) void destroySession(roomId);
    };
  }, [roomId, uid]);

  useEffect(() => {
    const session = sessions.get(roomId);
    if (!session) return;
    session.members = members;
    session.micEnabled = micEnabled;
    session.callback = (users) => callbackRef.current?.(users);
    if (!session.joined) return;
    session.operation = session.operation.then(() => applyMic(session)).catch((error) => {
      if (!sessionStorage.getItem("vox_minimized_room_id")) toast.error(error instanceof Error ? error.message : "تعذر تغيير حالة الميك");
    });
  }, [members, micEnabled, roomId]);

  return null;
}
