import { createFileRoute, Link } from "@tanstack/react-router";
import { AudioLines, Trophy } from "lucide-react";
import { Coin, IceHeader, SubHeader } from "@/components/app/AppShell";
import { liveRooms, type Room, type User } from "@/components/app/data";
import { meAsUser, useProfile } from "@/components/app/profile";
import { useCloud } from "@/components/app/cloud";
import { Avatar, LevelChip, VipChip } from "@/components/app/ui";

export type RankTab = "wealth" | "room" | "charm";

export const Route = createFileRoute("/rankings")({
  validateSearch: (s: Record<string, unknown>): { tab: RankTab } => {
    const t = s["tab"];
    return { tab: t === "room" || t === "charm" ? t : "wealth" };
  },
  head: () => ({
    meta: [
      { title: "التصنيفات | صدى شات" },
      { name: "description", content: "تصنيف الثروة والغرف والكاريزما في صدى شات" },
      { property: "og:title", content: "التصنيفات | صدى شات" },
      { property: "og:description", content: "تصنيف الثروة والغرف والكاريزما في صدى شات" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rankings,
});

const TABS: { k: RankTab; label: string }[] = [
  { k: "wealth", label: "الثروة" },
  { k: "room", label: "الغرفة" },
  { k: "charm", label: "الكاريزما" },
];

function Rankings() {
  const { tab } = Route.useSearch();
  const nav = Route.useNavigate();
  const profile = useProfile();
  const me = meAsUser(profile);
  const { data } = useCloud();
  const realUsers: User[] = (data?.profiles ?? []).filter(row => row.id !== data?.profile?.id).map(row => {
    const owned = (data?.equippedItems ?? []).filter((item: { user_id: string; catalog_id: string }) => item.user_id === row.id);
    const worn = (kind: string) => data?.catalog.find(item => item.kind === kind && owned.some((ownedItem: { catalog_id: string }) => ownedItem.catalog_id === item.id));
    const frame = worn("frame"), entry = worn("entry"), bubble = worn("bubble");
    return {
      id: row.id, uid: String(row.uid), name: row.name, avatar: row.avatar_url || row.avatar || me.avatar,
      frame: frame ? ("cloud-" + frame.id) as User["frame"] : null,
      entry: entry ? ("cloud-" + entry.id) as User["entry"] : null,
      bubble: bubble ? ("cloud-" + bubble.id) as User["bubble"] : "none",
      sid: row.special_id, level: row.level || 1, vip: row.vip || 0, gender: "m" as const, flag: "", bio: row.bio || "",
      fans: 0, following: 0, charm: row.gift_value || 0, wealth: row.coins || 0, gifts: [],
    };
  });
  const allUsers: User[] = [me, ...realUsers];

  const byWealth = [...allUsers].sort((a, b) => b.wealth - a.wealth);
  const byCharm = [...allUsers].sort((a, b) => b.charm - a.charm);
  const byRoom: Room[] = [...liveRooms()]
    .map((r) => {
      const ov = profile.roomMedia[r.id];
      return { ...r, name: ov?.name || r.name, img: ov?.cover || r.img };
    })
    .sort((a, b) => b.online - a.online);

  const userList = tab === "wealth" ? byWealth : byCharm;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="vip-card relative overflow-hidden rounded-b-[32px] pb-6 text-primary-foreground shadow-xl">
        <div className="relative">
          <SubHeader title="قائمة المتصدرين" dark />
        </div>
        <div className="mx-3.5 mt-1 grid grid-cols-3 gap-1 rounded-full bg-night/35 p-1 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => void nav({ search: { tab: t.k }, replace: true })}
              className={`press rounded-full py-1.5 text-[13px] font-black transition ${tab === t.k ? "gold-bg text-navy shadow" : "text-primary-foreground/75"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="px-3.5 pt-4">
          {tab === "room" ? (
            <RoomPodium list={byRoom} />
          ) : (
            <UserPodium list={userList} mode={tab} />
          )}
        </div>
      </div>
      <div className="-mt-3 px-3.5">
        {tab === "room" ? (
          <RoomRest list={byRoom} />
        ) : (
          <UserRest list={userList} mode={tab} />
        )}
      </div>
    </div>
  );
}

function UserPodium({ list, mode }: { list: User[]; mode: "wealth" | "charm" }) {
  const top = list.slice(0, 3);
  const podiumOrder = [top[1], top[0], top[2]].filter((u): u is User => Boolean(u));
  const score = (u: User) => (mode === "wealth" ? u.wealth : u.charm);

  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {podiumOrder.map((u) => {
        const rank = list.indexOf(u) + 1;
        const first = rank === 1;
        return (
          <Link key={u.id} to="/user/$id" params={{ id: u.id }} className="press flex flex-col items-center text-center">
            <Avatar img={u.avatar} frame={u.frame} size={first ? 68 : 54} className="my-2" ring={first ? "ring-2 ring-gold shadow-lg" : "ring-2 ring-secondary/60"} />
            <p className="mt-1 w-full truncate text-[12.5px] font-black">{u.name}</p>
            <span className="mt-0.5 text-[10.5px] text-gold">
              <Coin n={score(u)} gem={mode === "charm"} />
            </span>
            <div className={`mt-2 flex w-full items-center justify-center rounded-t-2xl font-black ${first ? "gold-bg h-14 text-[18px] text-navy shadow-lg" : rank === 2 ? "h-10 bg-secondary/20 text-[15px]" : "h-8 bg-secondary/15 text-[14px]"}`}>
              <Trophy className="me-1 h-3.5 w-3.5" />{rank}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function UserRest({ list, mode }: { list: User[]; mode: "wealth" | "charm" }) {
  const rest = list.slice(3);
  const score = (u: User) => (mode === "wealth" ? u.wealth : u.charm);
  return (
    <div className="surface divide-y overflow-hidden rounded-3xl">
      {rest.map((u, idx) => (
        <Link key={u.id} to="/user/$id" params={{ id: u.id }} className="press flex items-center gap-3 px-3.5 py-2.5 active:bg-muted/60">
          <span className="w-6 text-center text-[13px] font-black text-muted-foreground">{idx + 4}</span>
          <Avatar img={u.avatar} frame={u.frame} size={44} className="my-1" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-extrabold text-navy">{u.name}</p>
            <div className="mt-0.5 flex items-center gap-1">
              <LevelChip level={u.level} />
              <VipChip vip={u.vip} />
            </div>
          </div>
          <span className="shrink-0 text-[12px] text-navy">
            <Coin n={score(u)} gem={mode === "charm"} />
          </span>
        </Link>
      ))}
    </div>
  );
}

function RoomPodium({ list }: { list: Room[] }) {
  const top = list.slice(0, 3);
  const podiumOrder = [top[1], top[0], top[2]].filter((r): r is Room => Boolean(r));

  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {podiumOrder.map((r) => {
        const rank = list.indexOf(r) + 1;
        const first = rank === 1;
        return (
          <Link key={r.id} to="/room/$id" params={{ id: r.id }} className="press flex flex-col items-center text-center">
            <img src={r.img} alt={r.name} className={`rounded-2xl border-2 object-cover shadow-md ${first ? "h-[68px] w-[68px] border-gold" : "h-14 w-14 border-secondary/70"}`} />
            <p className="mt-1.5 w-full truncate text-[12.5px] font-black">{r.name}</p>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-gold">
              <AudioLines className="h-3 w-3" />{r.online}
            </span>
            <div className={`mt-2 flex w-full items-center justify-center rounded-t-2xl font-black ${first ? "gold-bg h-14 text-[18px] text-navy shadow-lg" : rank === 2 ? "h-10 bg-secondary/20 text-[15px]" : "h-8 bg-secondary/15 text-[14px]"}`}>
              <Trophy className="me-1 h-3.5 w-3.5" />{rank}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function RoomRest({ list }: { list: Room[] }) {
  const rest = list.slice(3);
  return (
    <div className="surface divide-y overflow-hidden rounded-3xl">
      {rest.map((r, idx) => (
        <Link key={r.id} to="/room/$id" params={{ id: r.id }} className="press flex items-center gap-3 px-3.5 py-2.5 active:bg-muted/60">
          <span className="w-6 text-center text-[13px] font-black text-muted-foreground">{idx + 4}</span>
          <img src={r.img} alt={r.name} className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-extrabold text-navy">{r.name}</p>
            <p className="text-[11px] text-muted-foreground">{r.flag} · {r.tag}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-black text-primary">
            <AudioLines className="h-3.5 w-3.5" />{r.online}
          </span>
        </Link>
      ))}
    </div>
  );
}