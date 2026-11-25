import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "./toast";

type RemoteAudioTrack = {
  play: () => void;
  getVolumeLevel?: () => number;
};

type RemoteAudioUser = {
  uid: string | number;
  audioTrack?: RemoteAudioTrack;
};

type LocalAudioTrack = {
  stop: () => void;
  close: () => void;
  getVolumeLevel?: () => number;
};

type RtcClient = {
  join: (appId: string, channel: string, token: string, uid: number) => Promise<unknown>;
  leave: () => Promise<void>;
  publish: (track: LocalAudioTrack) => Promise<void>;
  unpublish: (track: LocalAudioTrack) => Promise<void>;
  subscribe: (user: RemoteAudioUser, mediaType: "audio" | "video") => Promise<void>;
  renewToken: (token: string) => Promise<void>;
  enableAudioVolumeIndicator?: () => void;
  on: (event: string, callback: (...args: never[]) => void) => void;
};

/** Connects a room to Agora. The App Certificate stays in the Supabase Edge Function. */
export function useAgoraRoom(roomId: string, publishAudio: boolean, enabled = true) {
  const clientRef = useRef<RtcClient | null>(null);
  const trackRef = useRef<LocalAudioTrack | null>(null);
  const remoteUsersRef = useRef(new Map<string, RemoteAudioUser>());
  const publishRef = useRef(publishAudio);
  const [ready, setReady] = useState(false);
  const [speakingUids, setSpeakingUids] = useState<Set<string>>(() => new Set());
  const [speakingLevels, setSpeakingLevels] = useState<Map<string, number>>(() => new Map());
  const joinedUidRef = useRef<number | null>(null);

  useEffect(() => { publishRef.current = publishAudio; }, [publishAudio]);

  useEffect(() => {
    let disposed = false;
    let client: RtcClient | null = null;

    const getToken = async () => {
      // The backend uses the authenticated profile UID as the Agora UID.
      // This keeps the UID stable and also lets the UI map real speakers to avatars.
      const { data, error } = await supabase.functions.invoke("agora-token", {
        body: { room_id: roomId },
      });
      if (error) {
        const details = typeof data?.error === "string" ? data.error : error.message;
        throw new Error(details);
      }
      if (!data?.appId || !data?.token || !Number.isInteger(data?.uid) || data.uid <= 0 || !data?.channel) {
        throw new Error(data?.error || "إعدادات الصوت غير مكتملة");
      }
      return data as { appId: string; token: string; uid: number; channel: string };
    };

    const connect = async () => {
      try {
        const credentials = await getToken();
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        if (disposed) return;

        const instance = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }) as unknown as RtcClient;
        client = instance;
        clientRef.current = instance;
        joinedUidRef.current = credentials.uid;
        remoteUsersRef.current.clear();

        // Agora's volume-indicator event is not consistently emitted on every
        // Android WebView/device. Keep it as a fast path, but also poll the
        // actual local/remote audio tracks below so the speaking ring never
        // disappears just because the event stream is unavailable.
        instance.enableAudioVolumeIndicator?.();
        instance.on("volume-indicator", ((volumes: Array<{ uid: string | number; level: number }>) => {
          const next = new Map<string, number>();
          for (const v of volumes) {
            const uid = String(v.uid);
            const level = Math.max(0, Math.min(100, Number(v.level) || 0));
            if (level >= 3) next.set(uid, level);
          }
          setSpeakingLevels(next);
          setSpeakingUids(new Set(next.keys()));
        }) as (...args: never[]) => void);

        instance.on("user-published", (async (user: RemoteAudioUser, mediaType: "audio" | "video") => {
          try {
            await instance.subscribe(user, mediaType);
            if (mediaType === "audio" && user.audioTrack) {
              remoteUsersRef.current.set(String(user.uid), user);
              user.audioTrack.play();
            }
          } catch (error) {
            console.error("[Agora] subscribe failed", error);
          }
        }) as (...args: never[]) => void);

        instance.on("user-unpublished", ((user: RemoteAudioUser, mediaType: "audio" | "video") => {
          if (mediaType === "audio") remoteUsersRef.current.delete(String(user.uid));
        }) as (...args: never[]) => void);

        instance.on("user-left", ((user: RemoteAudioUser) => {
          remoteUsersRef.current.delete(String(user.uid));
          setSpeakingUids((prev) => {
            const next = new Set(prev);
            next.delete(String(user.uid));
            return next;
          });
        }) as (...args: never[]) => void);

        instance.on("token-privilege-will-expire", (async () => {
          try {
            const next = await getToken();
            await instance.renewToken(next.token);
          } catch (error) {
            console.error("[Agora] token renewal failed", error);
          }
        }) as (...args: never[]) => void);

        await instance.join(credentials.appId, credentials.channel, credentials.token, credentials.uid);
        if (disposed) {
          await instance.leave();
          return;
        }

        // Reliable speaking detection for Android: sample the real Agora
        // audio tracks. This also fixes remote-speaker waves when
        // volume-indicator is silent/unavailable in the WebView.
        const speakingTimer = window.setInterval(() => {
          if (disposed) return;
          const next = new Map<string, number>();
          const local = trackRef.current;
          if (local?.getVolumeLevel) {
            const level = Math.max(0, Math.min(100, Number(local.getVolumeLevel()) || 0));
            if (level >= 3) next.set(String(credentials.uid), level);
          }
          for (const [uid, remote] of remoteUsersRef.current) {
            const level = remote.audioTrack?.getVolumeLevel
              ? Math.max(0, Math.min(100, Number(remote.audioTrack.getVolumeLevel()) || 0))
              : 0;
            if (level >= 3) next.set(uid, level);
          }
          setSpeakingLevels(next);
          setSpeakingUids(new Set(next.keys()));
        }, 120);

        (instance as RtcClient & { __speakingTimer?: number }).__speakingTimer = speakingTimer;
        setReady(true);
      } catch (error) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : "تعذّر الاتصال الصوتي";
          toast(`الصوت: ${message}`);
          console.error("[Agora] room connection failed", error);
        }
      }
    };

    void connect();

    return () => {
      disposed = true;
      setReady(false);
      setSpeakingUids(new Set());
      remoteUsersRef.current.clear();
      clientRef.current = null;
      joinedUidRef.current = null;

      const track = trackRef.current;
      trackRef.current = null;
      if (track) {
        track.stop();
        track.close();
      }

      const speakingTimer = (client as (RtcClient & { __speakingTimer?: number }) | null)?.__speakingTimer;
      if (speakingTimer) window.clearInterval(speakingTimer);
      if (client) void client.leave().catch(error => console.error("[Agora] leave failed", error));
    };
  }, [roomId, enabled]);

  useEffect(() => {
    if (!enabled || !ready || !clientRef.current) return;
    let cancelled = false;

    const sync = async () => {
      const client = clientRef.current;
      if (!client) return;

      if (publishAudio && !trackRef.current) {
        try {
          const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
          const track = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: "speech_low_quality",
            AEC: true,
            AGC: true,
            ANS: true,
          }) as unknown as LocalAudioTrack;

          if (cancelled || !publishRef.current || clientRef.current !== client) {
            track.stop();
            track.close();
            return;
          }

          await client.publish(track);
          trackRef.current = track;
        } catch (error) {
          toast(error instanceof Error ? error.message : "تعذّر تشغيل المايك");
          console.error("[Agora] microphone publish failed", error);
        }
      } else if (!publishAudio && trackRef.current) {
        const track = trackRef.current;
        trackRef.current = null;
        try {
          await client.unpublish(track);
        } catch (error) {
          console.error("[Agora] unpublish failed", error);
        }
        track.stop();
        track.close();
      }
    };

    void sync();
    return () => { cancelled = true; };
  }, [publishAudio, ready, enabled]);

  useEffect(() => {
    if (!enabled || !ready) {
      setSpeakingUids(new Set());
      setSpeakingLevels(new Map());
    }
  }, [enabled, ready]);

  return { ready, speakingUids, speakingLevels };
}
