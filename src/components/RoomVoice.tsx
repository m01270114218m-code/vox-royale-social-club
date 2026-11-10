import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type IMicrophoneAudioTrack,
  type IBufferSourceAudioTrack,
} from "agora-rtc-sdk-ng";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { App as CapacitorApp } from "@capacitor/app";

type MusicCommand = { id: number; action: "pause" | "resume" | "seek" | "volume"; value?: number };
type MusicProgress = { currentTime: number; duration: number; playing: boolean };
type Props = { roomId: string; uid: string; members: string[]; micEnabled: boolean; musicFile?: File | null; musicCommand?: MusicCommand | null; onMusicProgress?: (progress: MusicProgress) => void; onSpeakingUsers?: (users: string[]) => void };

type TokenResponse = {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  role: "publisher" | "subscriber";
  expiresAt: number;
};

function numericRtcUid(userId: string): number { let hash = 0x811c9dc5; for (let i = 0; i < userId.length; i++) { hash ^= userId.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return (hash >>> 1) || 1; }

// Serialize Agora clients for the same user/room so React remounts can never overlap joins.
const rtcLifecycle = new Map<string, Promise<void>>();

export function RoomVoice({ roomId, uid, members, micEnabled, musicFile = null, musicCommand = null, onMusicProgress, onSpeakingUsers }: Props) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const musicRef = useRef<IBufferSourceAudioTrack | null>(null);
  const joinedRef = useRef(false);
  const publishedRef = useRef(false);
  const aliveRef = useRef(true);
  const roleRef = useRef<"host" | "audience">("audience");
  const operationRef = useRef(Promise.resolve());
  const tokenRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const micEnabledRef = useRef(micEnabled);
  const musicFileRef = useRef<File | null>(musicFile);
  micEnabledRef.current = micEnabled;
  musicFileRef.current = musicFile;
  const membersRef = useRef(members);
  membersRef.current = members;
  const onSpeakingUsersRef = useRef(onSpeakingUsers);
  onSpeakingUsersRef.current = onSpeakingUsers;
  const onMusicProgressRef = useRef(onMusicProgress);
  onMusicProgressRef.current = onMusicProgress;

  useEffect(() => {
    aliveRef.current = true;
    let effectAlive = true;
    let client: IAgoraRTCClient | null = null;
    const lifecycleKey = roomId + ':' + uid;
    const previousLifecycle = rtcLifecycle.get(lifecycleKey) ?? Promise.resolve();
    let releaseLifecycle!: () => void;
    const currentLifecycle = new Promise<void>((resolve) => { releaseLifecycle = resolve; });
    rtcLifecycle.set(lifecycleKey, currentLifecycle);

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

    // Android may suspend the WebView while another app is in front. Keep the
    // Agora client alive at the root and refresh/rejoin it when the app returns.
    const resumeRtc = (fromNative = false) => {
      if ((!fromNative && document.visibilityState !== "visible") || !client || !joinedRef.current) return;
      void serialize(async () => {
        if (!client || !joinedRef.current) return;
        if (client.connectionState === "DISCONNECTED") {
          await client.leave().catch(() => undefined);
          joinedRef.current = false;
          publishedRef.current = false;
          const access = await getToken();
          const nextRole = access.role === "publisher" ? "host" : "audience";
          await client.setClientRole(nextRole);
          roleRef.current = nextRole;
          await client.join(access.appId, access.channel, access.token, access.uid);
          joinedRef.current = true;
          if (micEnabledRef.current && nextRole === "host") await publishMicrophone();
        } else {
          await refreshToken();
          if (micEnabledRef.current && roleRef.current === "host") {
            if (!publishedRef.current) await publishMicrophone();
            else if (micRef.current && !micRef.current.enabled) await micRef.current.setEnabled(true);
          }
        }
      });
    };
    const nativeStateListener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) resumeRtc(true);
    });
    document.addEventListener("visibilitychange", resumeRtc);
    window.addEventListener("pageshow", resumeRtc);

    const start = async () => {
      try {
        await previousLifecycle;
        if (!effectAlive || !aliveRef.current) return;
        if (!uid || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("المتصفح أو WebView لا يدعم الوصول للميكروفون");
        }
        const access = await getToken();
        if (!effectAlive || !aliveRef.current) return;
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
        if (!effectAlive || !aliveRef.current) {
          await client.leave().catch(() => undefined);
          return;
        }
        joinedRef.current = true;
        if (micEnabledRef.current && initialRole === "host") {
          await publishMicrophone();
          if (musicFileRef.current) {
            const track = await AgoraRTC.createBufferSourceAudioTrack({ source: musicFileRef.current, encoderConfig: "speech_standard" });
            musicRef.current = track;
            track.startProcessAudioBuffer();
            await client.publish(track);
            track.play();
          }
        }
      } catch (error) {
        if (aliveRef.current) {
          console.error("[Agora] join failed", error);
          toast.error(error instanceof Error ? error.message : "فشل الاتصال بخدمة الصوت");
        }
      }
    };

    void start();

    return () => {
      effectAlive = false;
      aliveRef.current = false;
      document.removeEventListener("visibilitychange", resumeRtc);
      window.removeEventListener("pageshow", resumeRtc);
      void nativeStateListener.then((listener) => listener.remove()).catch(() => undefined);
      tokenRefreshRef.current = null;
      joinedRef.current = false;
      publishedRef.current = false;
      if (musicRef.current) {
        musicRef.current.stopProcessAudioBuffer();
        musicRef.current.stop();
        musicRef.current.close();
        musicRef.current = null;
      }
      if (micRef.current) {
        micRef.current.stop();
        micRef.current.close();
        micRef.current = null;
      }
      if (client) {
        client.removeAllListeners();
        void client.leave().catch(() => undefined).finally(() => {
          if (rtcLifecycle.get(lifecycleKey) === currentLifecycle) rtcLifecycle.delete(lifecycleKey);
          releaseLifecycle();
        });
      } else {
        if (rtcLifecycle.get(lifecycleKey) === currentLifecycle) rtcLifecycle.delete(lifecycleKey);
        releaseLifecycle();
      }
      clientRef.current = null;
    };
  // Membership is managed by the server; the token endpoint verifies current membership.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, uid]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !joinedRef.current) return;
    operationRef.current = operationRef.current.then(async () => {
      if (!musicFile) {
        if (musicRef.current) {
          await client.unpublish(musicRef.current).catch(() => undefined);
          musicRef.current.stopProcessAudioBuffer();
          musicRef.current.stop();
          musicRef.current.close();
          musicRef.current = null;
        }
        return;
      }
      if (!micEnabled) throw new Error("شغّل الميك أولاً حتى يتم بث الأغاني للجميع");
      if (musicRef.current) {
        await client.unpublish(musicRef.current).catch(() => undefined);
        musicRef.current.stopProcessAudioBuffer();
        musicRef.current.stop();
        musicRef.current.close();
        musicRef.current = null;
      }
      const track = await AgoraRTC.createBufferSourceAudioTrack({ source: musicFile, encoderConfig: "speech_standard" });
      musicRef.current = track;
      track.startProcessAudioBuffer();
      await client.publish(track);
      track.play();
      toast.success("بدأ بث الأغنية لجميع الموجودين على الميك");
    }).catch(error => {
      console.error("[Agora] music failed", error);
      toast.error(error instanceof Error ? error.message : "تعذر تشغيل الأغنية");
    });
  }, [musicFile, micEnabled]);

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
        // Re-publish the selected room song whenever the speaker returns to the mic.
        // The track is shared through Agora, so every room participant hears it.
        if (musicFileRef.current && !musicRef.current) {
          const musicTrack = await AgoraRTC.createBufferSourceAudioTrack({
            source: musicFileRef.current,
            encoderConfig: "speech_standard",
          });
          musicRef.current = musicTrack;
          musicTrack.startProcessAudioBuffer();
          await client.publish(musicTrack);
          musicTrack.play();
        }
      } else {
        if (publishedRef.current && micRef.current) {
          await client.unpublish(micRef.current).catch(() => undefined);
          publishedRef.current = false;
        }
        if (musicRef.current) {
          await client.unpublish(musicRef.current).catch(() => undefined);
          musicRef.current.stopProcessAudioBuffer();
          musicRef.current.stop();
          musicRef.current.close();
          musicRef.current = null;
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

  useEffect(() => {
    if (!musicCommand) return;
    const command = musicCommand;
    operationRef.current = operationRef.current.then(async () => {
      const track = musicRef.current;
      if (!track) return;
      if (command.action === "pause") {
        track.pauseProcessAudioBuffer();
        track.stop();
      } else if (command.action === "resume") {
        track.resumeProcessAudioBuffer();
        track.play();
      } else if (command.action === "seek") {
        track.seekAudioBuffer(Math.max(0, Math.min(track.duration, Number(command.value) || 0)));
      } else if (command.action === "volume") {
        // UI volume is 0-100; Agora track volume is 0-1000.
        track.setVolume(Math.max(0, Math.min(1000, (Number(command.value) || 0) * 10)));
      }
    }).catch((error) => {
      console.error("[Agora] music control failed", error);
      if (aliveRef.current) toast.error("تعذر التحكم في تشغيل الأغنية");
    });
  }, [musicCommand?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const track = musicRef.current;
      if (!track) {
        onMusicProgressRef.current?.({ currentTime: 0, duration: 0, playing: false });
        return;
      }
      onMusicProgressRef.current?.({
        currentTime: track.getCurrentTime(),
        duration: track.duration,
        playing: track.currentState === "playing",
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [roomId, uid]);

  return null;
}
