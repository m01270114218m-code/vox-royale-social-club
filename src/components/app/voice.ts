import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "./toast";

type RemoteAudioUser = { audioTrack?: { play: () => void } };
type LocalAudioTrack = { stop: () => void; close: () => void };
type RtcClient = {
  join: (appId: string, channel: string, token: string, uid: number) => Promise<unknown>;
  leave: () => Promise<void>;
  publish: (track: LocalAudioTrack) => Promise<void>;
  unpublish: (track: LocalAudioTrack) => Promise<void>;
  subscribe: (user: RemoteAudioUser, mediaType: "audio" | "video") => Promise<void>;
  renewToken: (token: string) => Promise<void>;
  on: (event: string, callback: (...args: never[]) => void) => void;
};

/** Connects a room to Agora. The App Certificate stays in the Supabase Edge Function. */
export function useAgoraRoom(roomId: string, publishAudio: boolean, enabled = true) {
  const clientRef = useRef<RtcClient | null>(null);
  const trackRef = useRef<LocalAudioTrack | null>(null);
  const publishRef = useRef(publishAudio);
  const [ready, setReady] = useState(false);
  const rtcUidRef = useRef(0);
  if (!rtcUidRef.current) {
    const values = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(values);
    rtcUidRef.current = (values[0] || Math.floor(Math.random() * 0xfffffffe) + 1) >>> 0;
    if (!rtcUidRef.current) rtcUidRef.current = 1;
  }

  useEffect(() => { publishRef.current = publishAudio; }, [publishAudio]);

  useEffect(() => {
    let disposed = false;
    let client: RtcClient | null = null;

    const getToken = async () => {
      const { data, error } = await supabase.functions.invoke("agora-token", { body: { room_id: roomId, rtc_uid: rtcUidRef.current } });
      if (error) throw new Error(error.message);
      if (!data?.appId || !data?.token || !Number.isInteger(data?.uid) || !data?.channel) {
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
        instance.on("user-published", (async (user: RemoteAudioUser, mediaType: "audio" | "video") => {
          try {
            await instance.subscribe(user, mediaType);
            if (mediaType === "audio") user.audioTrack?.play();
          } catch (error) {
            console.error("[Agora] subscribe failed", error);
          }
        }) as (...args: never[]) => void);
        instance.on("token-privilege-will-expire", (async () => {
          try { const next = await getToken(); await instance.renewToken(next.token); }
          catch (error) { console.error("[Agora] token renewal failed", error); }
        }) as (...args: never[]) => void);
        await instance.join(credentials.appId, credentials.channel, credentials.token, credentials.uid);
        if (disposed) { await instance.leave(); return; }
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
      clientRef.current = null;
      const track = trackRef.current;
      trackRef.current = null;
      if (track) { track.stop(); track.close(); }
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
            track.stop(); track.close(); return;
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
        try { await client.unpublish(track); } catch (error) { console.error("[Agora] unpublish failed", error); }
        track.stop(); track.close();
      }
    };
    void sync();
    return () => { cancelled = true; };
  }, [publishAudio, ready, enabled]);

  return { ready };
}
