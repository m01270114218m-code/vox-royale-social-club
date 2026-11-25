import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, MessageCircle, Send } from "lucide-react";
import { IceHeader, Badge } from "@/components/app/AppShell";
import { images, avatarAt, type User } from "@/components/app/data";
import { meAsUser, sendDm, useProfile } from "@/components/app/profile";
import { Avatar, LevelChip, SpecialId, VipChip } from "@/components/app/ui";
import megaphone from "@/assets/megaphone.png";
import bell from "@/assets/bell.png";
import gift from "@/assets/gift.png";
import { useCloud } from '@/components/app/cloud';
import { Coin } from '@/components/app/AppShell';
import { Media } from '@/components/app/ui';
import { INBOX_KINDS, inboxKind, inboxLabel, markRead, mine, unreadByKind, useInboxRead, type InboxKind } from '@/components/app/inbox';

export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>): { chat?: string } => {
    const c = typeof s["chat"] === "string" && s["chat"] ? s["chat"] : undefined;
    return c ? { chat: c } : {};
  },
  head: () => ({ meta: [{ title: "الرسائل | صدى شات" }, { name: "description", content: "إشعاراتك ورسائلك الرسمية ومكافآتك وأصدقاؤك" }, { property: "og:title", content: "الرسائل | صدى شات" }, { property: "og:description", content: "إشعاراتك ورسائلك الرسمية ومكافآتك وأصدقاؤك" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Messages,
});

const catArt: Record<InboxKind, string> = { notification: megaphone, official: bell, reward: gift };
const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });

function Messages() {
  const {data}=useCloud();
  const { chat } = Route.useSearch();
  const nav = Route.useNavigate();
  const profile = useProfile();
  const [tab, setTab] = useState<"m" | "f">("m");
  const [open, setOpen] = useState<InboxKind | null>(null);
  const seen = useInboxRead();
  const inbox = mine(data?.notifications ?? [], data?.profile?.id);
  const counts = unreadByKind(data?.notifications ?? [], data?.profile?.id, seen);
  const [draft, setDraft] = useState("");
  const realUsers: User[] = (data?.profiles ?? []).filter(row => row.id !== data?.profile?.id).map(row => {
    const owned = (data?.items ?? []).filter(item => item.user_id === row.id && item.equipped);
    const worn = (kind: string) => data?.catalog.find(item => item.kind === kind && owned.some(ownedItem => ownedItem.catalog_id === item.id));
    const frame = worn("frame");
    return {
      id: row.id, uid: String(row.uid), name: row.name, avatar: row.avatar || avatarAt(0),
      frame: frame ? ("cloud-" + frame.id) as User["frame"] : null,
      bubble: "none" as const, entry: null, sid: row.special_id, level: row.level || 1, vip: row.vip || 0,
      gender: "m" as const, flag: "", bio: row.bio || "", fans: 0, following: 0,
      charm: row.gift_value || 0, wealth: row.coins || 0, gifts: [],
    };
  });

  const activeUser = chat ? realUsers.find((u) => u.id === chat) : undefined;
  const openChat = (uid: string) => void nav({ search: { chat: uid } });
  const closeChat = () => void nav({ search: {} });

  if (activeUser) {
    const thread = profile.dms[activeUser.id] ?? [];
    const meU = meAsUser(profile);
    const send = () => {
      if (!draft.trim()) return;
      sendDm(activeUser.id, draft);
      setDraft("");
    };
    return (
      <div className="flex min-h-[calc(100vh-76px)] flex-col">
        <div className="sticky top-0 z-30 flex min-h-16 items-center gap-2.5 border-b bg-background/90 px-3 py-2 backdrop-blur-md">
          <button type="button" onClick={closeChat} aria-label="رجوع" className="press grid h-9 w-9 place-items-center rounded-full text-navy"><ChevronRight className="h-6 w-6" /></button>
          <span className="relative"><Avatar img={activeUser.avatar} frame={activeUser.frame} size={38} className="m-1.5" /><span className="absolute bottom-1 left-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" /></span>
          <div className="min-w-0 flex-1">
            <p className="user-name text-[14.5px] font-black text-navy">{activeUser.name}</p><div className="flex items-center gap-1"><LevelChip level={activeUser.level} /><VipChip vip={activeUser.vip} /></div>
            <div className="mt-0.5 flex items-center gap-1.5"><SpecialId uid={activeUser.uid} sid={activeUser.sid} /><span className="text-[10.5px] font-bold text-primary">متصل الآن</span></div>
          </div>
        </div>
        <div className="flex-1 space-y-2.5 px-3.5 py-4">
          {!thread.length && (
            <div className="flex flex-col items-center pt-8 text-center">
              <Avatar img={activeUser.avatar} frame={activeUser.frame} size={72} className="m-3" />
              <p className="mt-1 text-[15px] font-black text-navy">{activeUser.name}</p>
              <p className="mt-0.5 max-w-[240px] text-[12px] text-muted-foreground">{activeUser.bio}</p>
              <p className="mt-4 rounded-full bg-accent/60 px-3 py-1 text-[11.5px] font-bold text-navy">ابدأ المحادثة بتحية لطيفة</p>
            </div>
          )}
          {thread.map((m) => {
            const mine = m.from === "me";
            return (
              <div key={m.id} className={`flex items-end gap-1.5 ${mine ? "flex-row" : "flex-row-reverse"}`}>
                <Avatar img={mine ? meU.avatar : activeUser.avatar} size={28} />
                <div className={`flex flex-col ${mine ? "items-start" : "items-end"}`}>
                  <div className={`max-w-[240px] break-words px-3.5 py-2 text-[13.5px] leading-relaxed ${mine ? "dm-me rounded-[18px] rounded-br-[4px]" : "surface rounded-[18px] rounded-bl-[4px] text-navy"}`}>{m.text}</div>
                  <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{m.at}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-[76px] border-t bg-background/95 px-3 py-2 backdrop-blur">
          <div className="surface flex items-center gap-2 rounded-full py-1.5 pe-1.5 ps-4">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={300}
              placeholder="اكتب رسالتك..."
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-navy outline-none placeholder:text-muted-foreground"
            />
            <button type="button" onClick={send} aria-label="إرسال" className="press grid h-8 w-8 shrink-0 place-items-center rounded-full gold-bg text-navy shadow disabled:opacity-50" disabled={!draft.trim()}>
              <Send className="h-4 w-4 -scale-x-100" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dmUsers = realUsers.filter((u) => (profile.dms[u.id]?.length ?? 0) > 0);
  return (
    <div>
      <IceHeader>
        <div className="flex h-11 items-end gap-5">
          {([["m", "الرسائل"], ["f", "الأصدقاء"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`relative pb-1.5 leading-none ${tab === k ? "text-[22px] font-black text-navy" : "text-[15px] font-bold text-navy/55"}`}>
              {l}{tab === k && <span className="absolute -bottom-0.5 right-1/2 h-[3px] w-5 translate-x-1/2 rounded-full bg-navy" />}
            </button>
          ))}
        </div>
      </IceHeader>
      {tab === "m" ? (
        <div className="px-3.5 pt-6">
          {open === null ? (
            <>
              <div className="grid grid-cols-3">
                {INBOX_KINDS.map((k) => (
                  <button key={k} onClick={() => { setOpen(k); markRead(k); }} className="press flex flex-col items-center gap-1.5">
                    <span className="relative"><img src={catArt[k]} alt={inboxLabel[k]} className="h-[62px] w-[62px] rounded-full object-cover shadow-md ring-2 ring-secondary" />{counts[k] > 0 && <Badge n={Math.min(99, counts[k])} />}</span>
                    <span className="text-[13px] font-bold text-navy">{inboxLabel[k]}</span>
                  </button>
                ))}
              </div>
              {dmUsers.length > 0 ? (
                <div className="mt-6 space-y-2">
                  {dmUsers.map((u) => {
                    const last = profile.dms[u.id]!.at(-1)!;
                    return (
                      <button key={u.id} onClick={() => openChat(u.id)} className="room-card-pro press flex w-full items-center gap-3 p-2.5 text-start">
                        <Avatar img={u.avatar} frame={u.frame} size={50} className="m-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="user-name text-[14px] font-extrabold text-navy">{u.name} <span className="text-[12px]">{u.flag}</span></p>
                            <span className="shrink-0 text-[10.5px] text-muted-foreground">{last.at}</span>
                          </div>
                          <p className="truncate text-[12px] text-muted-foreground">{last.text}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-14 flex flex-col items-center gap-2">
                  <img src={images.mascot} alt="" className="h-36 w-36 rounded-full object-cover mix-blend-multiply" />
                  <p className="text-[13px] text-muted-foreground">لا توجد رسائل خاصة بعد</p>
                </div>
              )}
            </>
          ) : (
            <div>
              <button onClick={() => setOpen(null)} className="mb-3 flex items-center gap-1 text-[15px] font-extrabold text-navy"><ChevronRight className="h-5 w-5" />{inboxLabel[open]}</button>
              <div className="space-y-2.5 pb-3">
                {inbox.filter((n) => inboxKind(n.kind) === open).map((n) => {
                  const item = n.catalog_id ? data?.catalog.find((c) => c.id === n.catalog_id) : undefined;
                  return (
                    <article key={n.id} className={`inbox-card inbox-${open} flex items-start gap-2.5 p-3 ps-4`}>
                      <img src={catArt[open]} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-primary/10 px-2 text-[10px] font-black leading-5 text-primary">صدى شات · {inboxLabel[open]}</span><time className="shrink-0 text-[10px] text-muted-foreground">{fmt(n.created_at)}</time></div>
                        <h3 className="mt-1 text-[13.5px] font-black text-navy">{n.title}</h3>
                        <p className="mt-0.5 whitespace-pre-line break-words text-[12.5px] leading-relaxed text-navy/75">{n.body}</p>
                        {(n.coins > 0 || item?.url) && (
                          <div className="mt-2 flex items-center gap-2 rounded-xl bg-secondary/80 px-2.5 py-1.5">
                            {item?.url && <Media src={item.url} mime={item.mime} alt={item.name} className="h-10 w-12" />}
                            {item && <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-navy">{item.name}</span>}
                            {n.coins > 0 && <Coin n={n.coins} className="text-[13px] text-navy" />}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!inbox.some((n) => inboxKind(n.kind) === open) && <p className="py-14 text-center text-[13px] text-muted-foreground">لا توجد رسائل في «{inboxLabel[open]}» بعد</p>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 px-3.5 pt-3 pb-3">
          {realUsers.map((u) => (
            <div key={u.id} className="room-card-pro flex items-center gap-3 p-2.5">
              <Avatar img={u.avatar} frame={u.frame} size={50} className="m-1" />
              <div className="min-w-0 flex-1">
                <p className="user-name text-[14px] font-extrabold text-navy">{u.name} <span className="text-[12px]">{u.flag}</span></p>
                <p className="truncate text-[12px] text-muted-foreground">{u.bio}</p>
              </div>
              <button type="button" onClick={() => openChat(u.id)} className="press inline-flex items-center gap-1 rounded-full chip-active px-3 py-1.5 text-[11.5px] font-bold">
                <MessageCircle className="h-3.5 w-3.5" />رسالة
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
