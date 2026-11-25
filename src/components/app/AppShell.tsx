import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { ChevronRight, Search, AudioLines, X } from "lucide-react";
import { images, roomById, roomExists, ui, type Room } from "./data";
import { RoomView } from "./RoomView";
import { setActiveRoom, useActiveRoom, useAuth } from "./session";
import { addStat, profileAvatar, useProfile } from "./profile";
import { useCloud, cloudAction } from './cloud';
import { requiresUpdate } from './control-rules';
import { Button } from '@/components/ui/button';
import { DailyCard } from './DailyCard';
import { SplashAd } from './SplashAd';
import { backStep, hasBack, popBack } from './back';
import { unreadByKind, useInboxRead } from './inbox';
import { toast } from './toast';

export function IceHeader({ children, tall = false }: { children: ReactNode; tall?: boolean }) {
  return (
    <div className="relative">
      <img src={images.ice} alt="" className={`absolute inset-x-0 top-0 -z-10 w-full object-cover object-top ${tall ? "h-52" : "h-36"}`} />
      <div className={`absolute inset-x-0 top-0 -z-10 bg-gradient-to-b from-transparent via-background/10 to-background ${tall ? "h-52" : "h-36"}`} />
      <div className="relative px-3.5 pt-4">{children}</div>
    </div>
  );
}

export function SubHeader({ title, dark = false, transparent = false, right }: { title: string; dark?: boolean; transparent?: boolean; right?: ReactNode }) {
  const r = useRouter();
  const nav = useNavigate();
  const goBack = () => {
    if (r.history.canGoBack()) r.history.back();
    else void nav({ to: "/", replace: true });
  };
  return (
    <div className={`sticky top-0 z-30 flex h-12 items-center gap-1 px-2 ${transparent ? "bg-transparent text-navy" : dark ? "bg-night/70 text-night-foreground backdrop-blur-md" : "bg-background/85 text-navy backdrop-blur-md"}`}>
      <button type="button" onClick={goBack} aria-label="رجوع" className="press grid h-9 w-9 place-items-center rounded-full"><ChevronRight className="h-6 w-6" /></button>
      <h1 className="flex-1 text-[17px] font-extrabold">{title}</h1>
      {right}
    </div>
  );
}

export function Badge({ n, className = "" }: { n: number; className?: string }) {
  return <span className={`absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-secondary bg-badge px-1 text-[10px] font-bold leading-none text-primary-foreground ${className}`}>{n}</span>;
}

export function Coin({ n, gem = false, className = "" }: { n: number | string; gem?: boolean; className?: string }) {
  return <span className={`inline-flex items-center gap-1 font-bold ${className}`}><img src={gem ? ui.gem : ui.coin} alt="" className="h-4 w-4" />{typeof n === "number" ? n.toLocaleString("en") : n}</span>;
}

const MAIN = ["/", "/mine", "/events", "/messages", "/me"];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const auth = useAuth();
  const profile = useProfile();
  const {data:cloud}=useCloud();
  const isLogin = path === "/login";
  const isPublic=isLogin;
  const router = useRouter();
  const seen = useInboxRead();
  const routeRoom = /^\/room\/([^/]+)\/?$/.exec(path)?.[1] ?? null;
  const session = useActiveRoom();
  const activeRoom = routeRoom ?? session;

  useEffect(() => { if (routeRoom) setActiveRoom(routeRoom); }, [routeRoom]);
  // device-only sign-in gate (auth is undefined until hydrated)
  useEffect(() => { if (auth === null && !isPublic) void nav({ to: "/login", replace: true }); }, [auth, isPublic, nav]);
  // in-app activity time for the host center
  useEffect(() => {
    if (!auth) return;
    void cloudAction('activity',{kind:'app'}).catch(()=>{});
    const t = setInterval(() => { if (document.visibilityState === "visible") {addStat("app", 15);void cloudAction('activity',{kind:'app'}).catch(()=>{});} }, 15000);
    return () => clearInterval(t);
  }, [auth]);
  // Android phone back button: close an open sheet, else go back one page; exit only from home on a second press
  const pathRef = useRef(path); pathRef.current = path;
  useEffect(() => {
    let dead = false; let remove: (() => void) | undefined; let last = 0;
    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("backButton", () => {
        const step = backStep({ hasSheet: hasBack(), path: pathRef.current, canGoBack: router.history.canGoBack(), pressedRecently: Date.now() - last < 2000 });
        if (step === "close") popBack();
        else if (step === "back") router.history.back();
        else if (step === "home") void nav({ to: "/", replace: true });
        else if (step === "exit-hint") { last = Date.now(); toast("اضغط رجوع مرة أخرى للخروج"); }
        else void App.exitApp();
      });
      if (dead) void handle.remove(); else remove = () => void handle.remove();
    })().catch(() => {});
    return () => { dead = true; remove?.(); };
  }, [nav, router]);

  // a room link that points nowhere returns home instead of showing an empty screen
  const missingRoom = !!routeRoom && !!cloud && !roomExists(routeRoom);
  useEffect(() => { if (missingRoom) { setActiveRoom(null); toast("الغرفة غير موجودة"); void nav({ to: "/", replace: true }); } }, [missingRoom, nav]);

  const maintenance=cloud?.settings.find(s=>s.key==='maintenance')?.value;
  const update=cloud?.settings.find(s=>s.key==='update')?.value;
  const m=maintenance&&typeof maintenance==='object'&&!Array.isArray(maintenance)?maintenance:{};
  const u=update&&typeof update==='object'&&!Array.isArray(update)?update:{};
  const blocked=cloud?.profile?.banned||m['enabled']===true||requiresUpdate(1,Number(u['minimum']??1),u['forced']===true);
  if(blocked&&!isPublic&&!cloud?.roles.includes('admin'))return <div dir="rtl" className="mx-auto flex min-h-screen max-w-[440px] flex-col items-center justify-center gap-4 bg-background px-6 text-center"><img src={ui.castle} alt="" className="h-24 w-24 object-contain"/><h1 className="text-xl font-black text-navy">{cloud?.profile?.banned?'الحساب محظور':m['enabled']===true?'التطبيق تحت الصيانة':'تحديث مطلوب'}</h1><p className="text-sm text-muted-foreground">{m['enabled']===true?String(m['message']??'نعود إليك قريبًا'):''}</p>{typeof u['url']==='string'&&/^https:\/\//.test(u['url'])&&m['enabled']!==true&&<Button asChild><a href={u['url']} rel="noopener noreferrer">تحديث التطبيق</a></Button>}</div>;
  if ((auth === null || auth === undefined) && !isPublic) return <div className="mx-auto min-h-screen max-w-[440px] bg-night" />;
  const showNav = MAIN.includes(path);
  const party = path === "/" || path === "/mine" || path === "/events";
  const counts = unreadByKind(cloud?.notifications ?? [], cloud?.profile?.id, seen);
  const unread = counts.notification + counts.official + counts.reward;
  const tabs = [
    { to: "/", label: "حفلة", active: party, img: ui.castle, badge: 0 },
    { to: "/messages", label: "رسالة", active: path === "/messages", img: ui.mail, badge: unread },
    { to: "/me", label: "أنا", active: path === "/me", img: profileAvatar(profile), badge: 0, round: true },
  ];
  return (
    <div dir="rtl" className={`relative isolate mx-auto min-h-screen max-w-[440px] bg-background ${showNav ? "pb-[76px]" : ""}`}>
      {children}
      {activeRoom && cloud && roomExists(activeRoom) && !isLogin && !cloud?.rooms.some(r=>r.room_id===activeRoom&&r.banned) && <RoomView key={activeRoom} id={activeRoom} minimized={!routeRoom} />}
      {!routeRoom && session && cloud && roomExists(session) && !isLogin && <MiniRoom id={session} lifted={showNav} />}
      {auth && !isLogin && !routeRoom && <DailyCard />}
      {auth && !isLogin && <SplashAd />}
      {showNav && (
        <nav className="nav-ice nav-shadow fixed bottom-0 left-1/2 z-40 flex h-[62px] w-full max-w-[440px] -translate-x-1/2 items-end justify-around rounded-t-[22px] pb-1.5 text-primary-foreground">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} replace className="relative flex w-20 flex-col items-center">
              <span className={`relative grid place-items-center rounded-full transition-all duration-200 ${t.active ? "-mt-5 h-[50px] w-[50px] gold-bg shadow-lg ring-2 ring-secondary" : "h-9 w-9 opacity-75 grayscale-[35%]"}`}>
                <img src={t.img} alt="" className={t.round ? `rounded-full object-cover ${t.active ? "h-[42px] w-[42px]" : "h-8 w-8 border border-secondary"}` : t.active ? "h-9 w-9" : "h-8 w-8"} />
                {t.badge > 0 && <Badge n={Math.min(99, t.badge)} />}
              </span>
              <span className={`mt-0.5 text-[11px] font-bold ${t.active ? "" : "opacity-75"}`}>{t.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

export function PartyTabs({ active }: { active: "mine" | "party" | "events" }) {
  const items = [
    { k: "mine", to: "/mine", l: "ملكي" },
    { k: "party", to: "/", l: "حفلات" },
    { k: "events", to: "/events", l: "فعالية" },
  ] as const;
  return (
    <div className="flex h-11 items-center justify-between">
      <div className="flex items-end gap-5">
        {items.map((i) => (
          <Link key={i.k} to={i.to} replace className={`relative pb-1.5 leading-none transition-all ${active === i.k ? "text-[22px] font-black text-navy" : "text-[15px] font-bold text-navy/55"}`}>
            {i.l}
            {active === i.k && <span className="absolute -bottom-0.5 right-1/2 h-[3px] w-5 translate-x-1/2 rounded-full bg-navy" />}
          </Link>
        ))}
      </div>
      <Link to="/search" aria-label="بحث" className="press grid h-9 w-9 place-items-center rounded-full gold-bg text-navy shadow-md ring-2 ring-secondary/80"><Search className="h-[18px] w-[18px]" strokeWidth={2.6} /></Link>
    </div>
  );
}

export function RoomCard({ r }: { r: Room }) {
  const profile = useProfile();
  const {data}=useCloud();
  const control=data?.rooms.find(c=>c.room_id===r.id);
  const frame=data?.catalog.find(c=>c.id===control?.frame_id&&c.enabled);
  if(control?.banned)return null;
  const ov = profile.roomMedia[r.id];
  const cover = ov?.cover || r.img;
  const title = ov?.name || r.name;
  return (
    <Link to="/room/$id" params={{ id: r.id }} className="room-card-pro press flex items-center gap-3.5 p-2.5">
      <div className="relative shrink-0">
        <img src={cover} alt={title} className="h-[76px] w-[76px] rounded-2xl object-cover shadow-sm" />
        {frame?.url&&<img src={frame.url} alt="إطار الغرفة" className="pointer-events-none absolute -inset-2 h-[92px] w-[92px] max-w-none object-contain"/>}
        <span className="absolute bottom-1 right-1 rounded-md bg-night/70 px-1.5 py-px text-[9px] font-bold text-night-foreground backdrop-blur-sm">{r.tag}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5 py-0.5">
        <h3 className="truncate text-[15.5px] font-black leading-tight text-navy">{title}</h3>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] leading-none">{r.flag}</span>
            {r.vip > 0 && <span className="vip-card rounded-full px-2 py-px text-[10px] font-black leading-4 text-gold">VIP{r.vip}</span>}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[12.5px] font-extrabold text-primary">
            <AudioLines className="h-3.5 w-3.5" />{r.online}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Floating circle for a minimized room; tap to return, × to leave. */
function MiniRoom({ id, lifted }: { id: string; lifted: boolean }) {
  const room = roomById(id);
  const profile = useProfile();
  const cover = profile.roomMedia[id]?.cover || room.img;
  return (
    <div className={`fade-up fixed z-[45] ${lifted ? "bottom-[78px]" : "bottom-5"}`} style={{ left: "max(12px, calc(50% - 208px))" }}>
      <Link to="/room/$id" params={{ id }} aria-label={`العودة إلى ${room.name}`} className="mini-room press relative block h-14 w-14 rounded-full">
        <img src={cover} alt="" className="mini-spin h-full w-full rounded-full object-cover" />
        <span className="absolute inset-x-0 -bottom-1 mx-auto flex w-fit items-center gap-0.5 rounded-full bg-night/85 px-1.5 text-[8.5px] font-bold text-night-foreground"><AudioLines className="h-2.5 w-2.5 text-gold" />مباشر</span>
      </Link>
      <button onClick={() => setActiveRoom(null)} aria-label="مغادرة الغرفة" className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-night text-night-foreground shadow"><X className="h-3 w-3" /></button>
    </div>
  );
}
