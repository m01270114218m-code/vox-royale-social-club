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

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <MiniRoomController />
      <Toaster position="top-center" />
      <AppUpdateGate />
    </QueryClientProvider>
  );
}


function MiniRoomController() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<{ id: string; name: string; cover?: string | null; micEnabled?: boolean } | null>(null);
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem("vox_active_room");
        const minimized = sessionStorage.getItem("vox_minimized_room_id");
        if (!raw || !minimized) {
          setActive(null);
          return;
        }
        const parsed = JSON.parse(raw) as { id: string; name: string; cover?: string | null; micEnabled?: boolean };
        if (parsed.id !== minimized) {
          setActive(null);
          return;
        }
        setActive(parsed);
      } catch {
        setActive(null);
      }
    };
    read();
    const onMin = () => read();
    const onClose = () => {
      sessionStorage.removeItem("vox_active_room");
      sessionStorage.removeItem("vox_minimized_room_id");
      setActive(null);
    };
    window.addEventListener("vox-room-minimized", onMin);
    window.addEventListener("vox-room-closed", onClose);
    return () => {
      window.removeEventListener("vox-room-minimized", onMin);
      window.removeEventListener("vox-room-closed", onClose);
    };
  }, []);

  useEffect(() => {
    if (!active?.id) return;
    let alive = true;
    void supabase.from("room_members").select("user_id").eq("room_id", active.id).then(({ data }) => {
      if (alive) setMembers((data ?? []).map((row) => row.user_id));
    });
    return () => { alive = false; };
  }, [active?.id]);

  if (!active || !user?.id) return null;

  const restore = () => {
    sessionStorage.setItem("vox_room_transition", "restore");
    sessionStorage.removeItem("vox_minimized_room_id");
    sessionStorage.removeItem("vox_active_room");
    setActive(null);
    window.dispatchEvent(new CustomEvent("vox-room-restored"));
    void navigate({ to: "/room/$id", params: { id: active.id } });
    window.setTimeout(() => sessionStorage.removeItem("vox_room_transition"), 1500);
  };

  return (
    <>
      <Suspense fallback={null}>
        <MiniRoomVoice
          roomId={active.id}
          uid={user.id}
          members={members}
          micEnabled={!!active.micEnabled}
        />
      </Suspense>
      <button
        type="button"
        onClick={restore}
        aria-label={`العودة إلى غرفة ${active.name}`}
        title={`العودة إلى ${active.name}`}
        className="fixed bottom-24 right-4 z-[120] flex h-16 w-16 touch-manipulation items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-black/80 shadow-2xl shadow-gold/30 transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        {active.cover ? (
          <img src={active.cover} alt={active.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">🎙️</span>
        )}
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-black text-black">الغرفة</span>
      </button>
    </>
  );
}
