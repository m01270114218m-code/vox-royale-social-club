import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import { AppUpdateGate } from "@/components/AppUpdateGate";

const MiniRoomVoice = lazy(() => import("@/components/RoomVoice").then((m) => ({ default: m.RoomVoice })));

function NotFoundComponent() {
  const navigate = useNavigate();
  useEffect(() => {
    // Recover stale/deep links gracefully instead of leaving users on a dead 404 screen.
    void navigate({ to: "/", replace: true });
  }, [navigate]);
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-primary/20" />
        <h1 className="text-xl font-bold text-foreground">صدي شات</h1>
        <p className="mt-2 text-sm text-muted-foreground">جارٍ إعادتك إلى الصفحة الرئيسية…</p>
        <Link to="/" className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">الصفحة الرئيسية</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: "صدي شات — غرف صوتية فاخرة" },
      { name: "description", content: "صدي شات: غرف دردشة صوتية مباشرة ومقاعد وأصدقاء." },
      { property: "og:title", content: "صدي شات" },
      { property: "og:description", content: "غرف دردشة صوتية مباشرة ومقاعد وأصدقاء." },
      { name: "theme-color", content: "#1a0f24" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
          ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Reem+Kufi:wght@600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let appUrlListener: { remove: () => Promise<void> } | undefined;

    const completeGoogleOAuth = async (url: string) => {
      if (!url.startsWith("com.voxroyale.app://auth/callback")) return;
      const callbackUrl = new URL(url);
      const authCode = callbackUrl.searchParams.get("code");
      if (!authCode) {
        console.error("[Google OAuth] Callback did not include an authorization code:", callbackUrl.searchParams.get("error_description"));
        await Browser.close().catch(() => undefined);
        void navigate({ to: "/auth", replace: true });
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(authCode);
      if (!active) return;
      if (error) {
        console.error("[Google OAuth] Callback exchange failed:", error.message);
        await Browser.close().catch(() => undefined);
        void navigate({ to: "/auth", replace: true });
        return;
      }
      await Browser.close().catch(() => undefined);
      void navigate({ to: "/", replace: true });
    };

    void App.addListener("appUrlOpen", ({ url }) => { void completeGoogleOAuth(url); })
      .then((listener) => { appUrlListener = listener; if (!active) void listener.remove(); });
    void App.getLaunchUrl().then((launch) => {
      if (active && launch?.url) void completeGoogleOAuth(launch.url);
    }).catch((error) => console.warn("[Google OAuth] Could not read launch URL:", error));

    return () => {
      active = false;
      if (appUrlListener) void appUrlListener.remove();
    };
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <MiniRoomController />
      <Toaster position="bottom-center" visibleToasts={3} offset={24} />
      <AppUpdateGate />
    </QueryClientProvider>
  );
}


type ActiveRoomState = {
  id: string;
  name: string;
  cover?: string | null;
  micEnabled?: boolean;
  minimized: boolean;
  members: string[];
  musicFile?: File | null;
  musicCommand?: { id: number; action: "pause" | "resume" | "seek" | "volume"; value?: number } | null;
};

function MiniRoomController() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveRoomState | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("vox_active_room");
        if (!raw) { setActive(null); return; }
        const parsed = JSON.parse(raw) as { id: string; name: string; cover?: string | null; micEnabled?: boolean };
        if (!parsed.id) { setActive(null); return; }
        const minimized = localStorage.getItem("vox_minimized_room_id") === parsed.id
          || !window.location.pathname.startsWith(`/room/${parsed.id}`);
        setActive((current) => ({
          ...parsed,
          minimized,
          members: current?.id === parsed.id ? current.members : [],
          musicFile: current?.id === parsed.id ? current.musicFile : null,
          musicCommand: current?.id === parsed.id ? current.musicCommand : null,
        }));
      } catch { setActive(null); }
    };
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<Partial<ActiveRoomState>>).detail;
      if (!detail?.id || !detail.name) return;
      const persisted = { id: detail.id, name: detail.name, cover: detail.cover ?? null, micEnabled: !!detail.micEnabled };
      localStorage.setItem("vox_active_room", JSON.stringify(persisted));
      setActive((current) => ({
        ...persisted,
        minimized: localStorage.getItem("vox_minimized_room_id") === detail.id,
        members: detail.members ?? current?.members ?? [],
        musicFile: detail.musicFile === undefined ? current?.musicFile ?? null : detail.musicFile,
        musicCommand: detail.musicCommand === undefined ? current?.musicCommand ?? null : detail.musicCommand,
      }));
    };
    const onMin = () => read();
    const onMusicFile = (event: Event) => {
      const file = (event as CustomEvent<{ file: File | null }>).detail?.file ?? null;
      setActive((current) => current ? { ...current, musicFile: file } : current);
    };
    const onRestore = () => {
      localStorage.removeItem("vox_minimized_room_id");
      localStorage.removeItem("vox_minimized_room");
      setActive((current) => current ? { ...current, minimized: false } : current);
    };
    const onClose = () => {
      localStorage.removeItem("vox_active_room");
      localStorage.removeItem("vox_minimized_room_id");
      localStorage.removeItem("vox_minimized_room");
      setActive(null);
    };
    read();
    window.addEventListener("vox-room-session", onSession);
    window.addEventListener("vox-room-music-file", onMusicFile);
    window.addEventListener("vox-room-minimized", onMin);
    window.addEventListener("vox-room-restored", onRestore);
    window.addEventListener("vox-room-closed", onClose);
    return () => {
      window.removeEventListener("vox-room-session", onSession);
      window.removeEventListener("vox-room-music-file", onMusicFile);
      window.removeEventListener("vox-room-minimized", onMin);
      window.removeEventListener("vox-room-restored", onRestore);
      window.removeEventListener("vox-room-closed", onClose);
    };
  }, []);

  useEffect(() => {
    if (!active?.id || !user?.id) return;
    let alive = true;
    const refreshRoomState = async () => {
      const { data: membership, error: memberError } = await supabase.from("room_members")
        .select("user_id").eq("room_id", active.id).eq("user_id", user.id).maybeSingle();
      if (!alive || memberError) return;
      if (!membership) {
        localStorage.removeItem("vox_active_room");
        localStorage.removeItem("vox_minimized_room_id");
        localStorage.removeItem("vox_minimized_room");
        setActive(null);
        return;
      }
      const { data: seat } = await supabase.from("room_seats").select("user_id,is_muted")
        .eq("room_id", active.id).eq("user_id", user.id).maybeSingle();
      if (!alive) return;
      setActive((current) => current?.id === active.id
        ? { ...current, micEnabled: !!seat && !seat.is_muted && localStorage.getItem("vox_mic_permission_granted") === "1" }
        : current);
    };
    void refreshRoomState();
    const channel = supabase.channel(`persistent-room-${active.id}-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${active.id}` }, () => { void refreshRoomState(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_seats", filter: `room_id=eq.${active.id}` }, () => { void refreshRoomState(); })
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [active?.id, user?.id]);

  if (!active || !user?.id) return null;

  const restore = () => {
    localStorage.removeItem("vox_minimized_room_id");
    localStorage.removeItem("vox_minimized_room");
    setActive((current) => current ? { ...current, minimized: false } : current);
    window.dispatchEvent(new CustomEvent("vox-room-restored"));
    void navigate({ to: "/room/$id", params: { id: active.id } });
  };

  return (
    <>
      <Suspense fallback={null}>
        <MiniRoomVoice
          roomId={active.id}
          uid={user.id}
          members={active.members}
          micEnabled={!!active.micEnabled}
          musicFile={active.musicFile ?? null}
          musicCommand={active.musicCommand ?? null}
          onMusicProgress={(progress) => window.dispatchEvent(new CustomEvent("vox-room-music-progress", { detail: progress }))}
          onSpeakingUsers={(users) => window.dispatchEvent(new CustomEvent("vox-room-speaking-users", { detail: users }))}
        />
      </Suspense>
      {active.minimized && <button
        type="button"
        onClick={restore}
        aria-label={`العودة إلى غرفة ${active.name}`}
        title={`العودة إلى ${active.name}`}
        className="fixed bottom-24 right-4 z-[120] flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-black/80 shadow-2xl shadow-gold/30"
      >
        {active.cover ? (
          <img src={active.cover} alt={active.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">🎙️</span>
        )}
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-black text-black">الغرفة</span>
      </button>}
    </>
  );
}
