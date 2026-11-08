import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = { roomId: string; uid: string; members: string[]; micEnabled: boolean; onSpeakingUsers?: (users: string[]) => void };

type TokenResponse = {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  role: "publisher" | "subscriber";
  expiresAt: number;
};

function numericRtcUid(userId: string): number { let hash = 0x811c9dc5; for (let i = 0; i < userId.length; i++) { hash ^= userId.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return (hash >>> 1) || 1; }

export function RoomVoice({ roomId, uid, members, micEnabled, onSpeakingUsers }: Props) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const joinedRef = useRef(false);
  const publishedRef = useRef(false);
  const aliveRef = useRef(true);
  const roleRef = useRef<"host" | "audience">("audience");
  const operationRef = useRef(Promise.resolve());
  const tokenRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const micEnabledRef = useRef(micEnabled);
  micEnabledRef.current = micEnabled;
  const membersRef = useRef(members);
  membersRef.current = members;
  const onSpeakingUsersRef = useRef(onSpeakingUsers);
  onSpeakingUsersRef.current = onSpeakingUsers;

  useEffect(() => {
    aliveRef.current = true;
    let client: IAgoraRTCClient | null = null;

    const getToken = async (): Promise<TokenResponse> => {
      const { data, error } = await supabase.functions.invoke("agora-rtc-token", {
        body: { roomId },
      });
      if (error) throw error;
      if (!data?.token || !data?.appId || !data?.channel || !data?.uid) {
        throw new Error(data?.error || "تعذر الحصول على رمز Agora");
      }
      return data as TokenResponse;
    };

    const refreshToken = async () => {
      if (!client || !joinedRef.current) return;
      const access = await getToken();
      await client.renewToken(access.token);
      const nextRole = access.role === "publisher" ? "host" : "audience";
      if (roleRef.current !== nextRole) {
        await client.setClientRole(nextRole);
        roleRef.current = nextRole;
      }
    };
    tokenRefreshRef.current = refreshToken;

    const publishMicrophone = async () => {
      if (!client || !joinedRef.current || !micEnabledRef.current || publishedRef.current) return;
      await refreshToken();
      if (roleRef.current !== "host") {
        throw new Error("حسابك ليس لديه إذن الصعود للميك");
      }
      const track = micRef.current ?? await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "speech_low_quality",
        AEC: true,
        ANS: true,
        AGC: true,
      });
      micRef.current = track;
      if (!track.enabled) await track.setEnabled(true);
      await client.publish(track);
      publishedRef.current = true;
    };

    const unpublishMicrophone = async () => {
      if (!client || !publishedRef.current) return;
      const track = micRef.current;
      if (track) {
        await client.unpublish(track).catch(() => undefined);
        track.setEnabled(false);
      }
      publishedRef.current = false;
      await refreshToken();
    };

    const serialize = (task: () => Promise<void>) => {
      operationRef.current = operationRef.current
        .then(task)
        .catch((error) => {
          if (aliveRef.current) {
            console.error("[Agora RTC]", error);
            toast.error(error instanceof Error ? error.message : "تعذر تشغيل الصوت");
          }
        });
      return operationRef.current;
    };

    const onUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      if (!client || mediaType !== "audio") return;
      try {
        await client.subscribe(user, mediaType);
        user.audioTrack?.play();
      } catch (error) {
        console.error("[Agora] subscribe failed", error);
      }
    };
    const onUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      user.audioTrack?.stop();
    };

    const start = async () => {
      try {
        if (!uid || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("المتصفح أو WebView لا يدعم الوصول للميكروفون");
        }
        const access = await getToken();
        client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = client;
        client.on("user-published", onUserPublished);
        client.on("user-unpublished", onUserUnpublished);
        const rtcToUser = new Map(membersRef.current.map((memberId) => [numericRtcUid(memberId), memberId]));
        rtcToUser.set(numericRtcUid(uid), uid);
        client.enableAudioVolumeIndicator();
        client.on("volume-indicator", (speakers) => {
          const active = speakers.filter((speaker) => speaker.level >= 18).map((speaker) => rtcToUser.get(Number(speaker.uid))).filter((userId): userId is string => !!userId);
          onSpeakingUsersRef.current?.([...new Set(active)]);
        });
        client.on("token-privilege-will-expire", () => {
          void serialize(refreshToken);
        });
        const initialRole = access.role === "publisher" ? "host" : "audience";
        await client.setClientRole(initialRole);
        roleRef.current = initialRole;
        await client.join(access.appId, access.channel, access.token, access.uid);
        joinedRef.current = true;
        if (micEnabledRef.current && initialRole === "host") {
          await publishMicrophone();
        }
      } catch (error) {
        if (aliveRef.current) {
          console.error("[Agora] join failed", error);
          toast.error(error instanceof Error ? error.message : "فشل الاتصال بخدمة الصوت");
        }
      }
    };

    const lifecycleKey = roomId + ":" + uid;
    const previousLifecycle = rtcLifecycle.get(lifecycleKey) ?? Promise.resolve();
    let releaseLifecycle!: () => void;
    const currentLifecycle = new Promise<void>((resolve) => { releaseLifecycle = resolve; });
    rtcLifecycle.set(lifecycleKey, previousLifecycle.then(() => currentLifecycle));

    void previousLifecycle.then(() => {
      if (aliveRef.current) void start();
    });

    return () => {
      aliveRef.current = false;
      tokenRefreshRef.current = null;
      joinedRef.current = false;
      publishedRef.current = false;
      const finishLeave = async () => {
        if (micRef.current) {
          micRef.current.stop();
          micRef.current.close();
          micRef.current = null;
        }
        if (client) {
          client.removeAllListeners();
          await client.leave().catch(() => undefined);
        }
        clientRef.current = null;
        releaseLifecycle();
        if (rtcLifecycle.get(lifecycleKey) === currentLifecycle) rtcLifecycle.delete(lifecycleKey);
      };
      void finishLeave();
    };
  // Membership is managed by the server; the token endpoint verifies current membership.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, uid]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !joinedRef.current) return;
    operationRef.current = operationRef.current.then(async () => {
      if (micEnabled) {
        const access = await (async () => {
          const { data, error } = await supabase.functions.invoke("agora-rtc-token", { body: { roomId } });
          if (error) throw error;
          return data as TokenResponse;
        })();
        await client.renewToken(access.token);
        const nextRole = access.role === "publisher" ? "host" : "audience";
        if (roleRef.current !== nextRole) {
          await client.setClientRole(nextRole);
          roleRef.current = nextRole;
        }
        if (nextRole !== "host") throw new Error("انتظر موافقة صاحب الغرفة للصعود إلى الميك");
        if (!micRef.current) {
          micRef.current = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: "speech_low_quality",
            AEC: true,
            ANS: true,
            AGC: true,
          });
        }
        await micRef.current.setEnabled(true);
        if (!publishedRef.current) {
          await client.publish(micRef.current);
          publishedRef.current = true;
        }
      } else {
        if (publishedRef.current && micRef.current) {
          await client.unpublish(micRef.current).catch(() => undefined);
          publishedRef.current = false;
        }
        if (micRef.current) await micRef.current.setEnabled(false);
        const { data, error } = await supabase.functions.invoke("agora-rtc-token", { body: { roomId } });
        if (!error && data?.token) {
          await client.renewToken(data.token);
          const nextRole = data.role === "publisher" ? "host" : "audience";
          if (roleRef.current !== nextRole) {
            await client.setClientRole(nextRole);
            roleRef.current = nextRole;
          }
        }
      }
    }).catch((error) => {
      console.error("[Agora] microphone state failed", error);
      if (aliveRef.current) toast.error(error instanceof Error ? error.message : "تعذر تفعيل الميكروفون");
    });
  }, [micEnabled, roomId]);

  return null;
}
