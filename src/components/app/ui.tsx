import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { frames, roleImg, icons, images, avatarAt, sidTone, type FrameKey } from "./data";
import { useCloudState } from './cloud-state';
import type { Role } from "./permissions";
import { pushBack } from './back';

/** Avatar with an optional decorative frame drawn around it. */
export function Avatar({ img, frame, size, className = "", ring = "" }: { img: string; frame?: FrameKey | null; size: number; className?: string; ring?: string }) {
  const { catalog } = useCloudState();
  const cloudFrame = typeof frame === "string" && frame.startsWith("cloud-") ? catalog.find(c => c.id === frame.slice(6) && c.kind === "frame" && c.enabled) : undefined;
  const frameImage = cloudFrame?.url || (frame ? frames[frame]?.img : null);
  const fs = Math.round(size * 1.42);
  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      <img src={img || avatarAt(0)} alt="" className={`h-full w-full rounded-full object-cover ${ring}`} onError={(e) => { if (e.currentTarget.dataset.fallback !== "1") { e.currentTarget.dataset.fallback = "1"; e.currentTarget.src = avatarAt(0); } }} />
      {frameImage && <img src={frameImage} alt="" className="pointer-events-none absolute max-w-none" style={{ width: fs, height: fs, left: (size - fs) / 2, top: (size - fs) / 2 }} onError={(e) => { const el=e.currentTarget; if(el.dataset.fallback!=="1"){el.dataset.fallback="1";el.src=frames.ice.img;}else{el.style.display="none";} }} />}
    </span>
  );
}

/** Detect how an uploaded asset should be shown. */
export function mediaKind(src:string,mime?:string|null):'video'|'audio'|'svga'|'image'|'file'{
  const m=(mime??'').toLowerCase(); const ext=(src.split('?')[0]?.split('.').at(-1)??'').toLowerCase();
  if(m.includes('svga')||ext==='svga')return 'svga';
  if(m.startsWith('video')||['mp4','webm','mov','m4v','ogv'].includes(ext))return 'video';
  if(m.startsWith('audio')||['mp3','wav','ogg','m4a','aac','flac','opus'].includes(ext))return 'audio';
  if(m.startsWith('image')||['png','jpg','jpeg','gif','webp','svg','avif','apng','bmp'].includes(ext)||src.startsWith('data:image'))return 'image';
  return m&&!m.startsWith('image')?'file':'image';
}
/** SVGA animation drawn on a canvas; the player is loaded only in the browser. */
function Svga({src,className,loop,onEnded}:{src:string;className:string;loop:boolean;onEnded?:(()=>void)|undefined}){
  const ref=useRef<HTMLCanvasElement>(null);
  const ended=useRef(onEnded); ended.current=onEnded;
  useEffect(()=>{
    let dead=false; let stop:(()=>void)|undefined;
    void (async()=>{
      const {Parser,Player}=await import('svga');
      const parser=new Parser();
      const video=await parser.load(src);
      if(dead||!ref.current){parser.destroy();return;}
      const player=new Player({container:ref.current,loop:loop?0:1});
      await player.mount(video);
      player.onEnd=()=>ended.current?.();
      player.start();
      stop=()=>{player.destroy();parser.destroy();};
      if(dead)stop();
    })().catch(()=>{});
    return ()=>{dead=true;stop?.();};
  },[src,loop]);
  return <canvas ref={ref} className={`object-contain ${className}`}/>;
}
/** Renders any uploaded asset (image, GIF, WebP, SVG, SVGA, video, song, sound) exactly as it was uploaded. */
export function Media({src,mime,alt='',className='',controls=false,loop=true,onEnded}:{src:string;mime?:string|null|undefined;alt?:string;className?:string;controls?:boolean;loop?:boolean;onEnded?:(()=>void)|undefined}){
  if(!src)return null;
  const k=mediaKind(src,mime);
  if(k==='svga')return <Svga src={src} className={className} loop={loop} onEnded={onEnded}/>;
  if(k==='video')return <video src={src} className={`object-contain ${className}`} autoPlay muted={!controls} loop={loop} playsInline controls={controls} onEnded={onEnded}/>;
  if(k==='audio')return controls?<audio src={src} controls className={`w-full ${className}`} onEnded={onEnded}/>:<span className={`grid place-items-center rounded-xl bg-primary/10 text-primary ${className}`}><svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>;
  if(k==='file')return <span className={`grid place-items-center rounded-xl bg-muted text-[10px] font-bold text-muted-foreground ${className}`} dir="ltr">{(src.split('?')[0]?.split('.').at(-1)??'file').toUpperCase()}</span>;
  return <img src={src} alt={alt} className={`object-contain ${className}`} onError={(e) => { if (e.currentTarget.dataset.fallback !== "1") { e.currentTarget.dataset.fallback = "1"; e.currentTarget.src = images.mascot; } }} />;
}

/** Color the admin set for a user's ID / name. */
export function useUserColors(uid:string){
  const {profiles}=useCloudState();
  const row=profiles.find(p=>String(p.uid)===uid||p.special_id===uid);
  return {name:row?.name_color??null,id:row?.id_color??null};
}
/** User name painted with the admin-selected color. */
export function UserName({uid,name,className=''}:{uid:string;name:string;className?:string}){
  const c=useUserColors(uid);
  return <span className={`${c.name?'name-tinted':''} ${className}`} style={c.name?{['--nc' as string]:c.name}:undefined}>{name}</span>;
}

/** User ID; transparent glass chip tinted with the admin color, special IDs animated. */
export function SpecialId({ uid, sid, className = "" }: { uid: string; sid: string | null; className?: string }) {
  const colors=useUserColors(uid);
  const tone = sidTone(sid);
  const style=colors.id?{['--idc' as string]:colors.id}:undefined;
  if (!sid) return (
    <span className={`id-glass inline-flex h-[18px] items-center gap-0.5 rounded-full pe-2 ps-0.5 text-[10.5px] font-black leading-none tracking-wide ${className}`} style={style} dir="ltr">
      <span className="id-glass-tag">ID</span>
      <span>{uid}</span>
    </span>
  );
  return (
    <span className={`sid-pro sid-${tone||'blue'} relative inline-flex h-[22px] items-center ps-1 pe-2.5 ${className}`} style={colors.id?{['--sid' as string]:colors.id}:undefined} dir="ltr" title="ID مميز">
      <span className="sid-pro-tag">ID</span>
      <span className="sid-text text-[12.5px] font-black tracking-[0.06em]">{sid}</span>
    </span>
  );
}

export function RoleBadge({ role, className = "h-4 w-4" }: { role: Role; className?: string }) {
  if (role === "member") return null;
  return <img src={roleImg[role]} alt={role === "owner" ? "مالك" : "مشرف"} className={className} onError={(e)=>{const el=e.currentTarget;if(el.dataset.fallback!=="1"){el.dataset.fallback="1";el.src=icons.badge;}else{el.style.visibility="hidden";}}} />;
}

/** Level badge — restore the original individual artwork for every level number. */
export function LevelChip({ level }: { level: number }) {
  const {catalog} = useCloudState();
  const lv=Math.min(100,Math.max(1,level));
  const custom=catalog.find(c=>c.kind==='level'&&c.rank===lv&&c.enabled);
  const tier=Math.min(5,Math.floor((lv-1)/20));
  return <span className={`rank-pill lv-t${tier} inline-flex h-[18px] shrink-0 items-center ps-[22px] pe-1.5`} dir="ltr" title={`المستوى ${lv}`}>
    <img src={custom?.url || rankArt.level[lv-1]} alt="" className="rank-pill-icon"/>
    <b className="text-[10px] font-black leading-none">Lv.{lv}</b>
  </span>;
}
/** VIP badge — restore the original numbered VIP artwork and color tiers. */
export function VipChip({ vip }: { vip: number }) {
  const {catalog} = useCloudState();
  if (!vip) return null;
  const n=Math.min(12,Math.max(1,vip));
  const custom=catalog.find(c=>c.kind==='vip'&&c.rank===n&&c.enabled);
  const tier=n<=3?0:n<=6?1:n<=9?2:3;
  return <span title={`VIP ${n}`} aria-label={`VIP ${n}`} dir="ltr" className={`rank-pill vip-t${tier} inline-flex h-[18px] shrink-0 items-center ps-[22px] pe-1.5`}><img src={custom?.url || rankArt.vip[n-1]} alt="" className="rank-pill-icon"/><b className="text-[9.5px] font-black italic leading-none">VIP{n}</b></span>;
}
/** Badges the user owns (bought or sent by the administration), shown in one tidy row under the ID. */
export function UserBadges({userId,align='center',size=26}:{userId:string;align?:'center'|'start';size?:number}) {
  const {catalog,items}=useCloudState();
  const owned=new Set(items.filter(i=>i.user_id===userId).map(i=>i.catalog_id));
  const list=catalog.filter(c=>c.kind==='badge'&&c.enabled&&c.url&&owned.has(c.id));
  if(!userId||!list.length)return null;
  return <div className={`mt-1.5 flex max-w-full flex-wrap items-center gap-1.5 ${align==='center'?'justify-center':'justify-start'}`}>{list.map(c=><span key={c.id} title={c.name} className="grid shrink-0 place-items-center overflow-hidden" style={{height:size,['--bh' as string]:`${size}px`}}><Media src={c.url} mime={c.mime} alt={c.name} className="h-[var(--bh)] w-auto max-w-[76px]"/></span>)}</div>;
}
export function GenderChip({ g }: { g: "m" | "f" }) {
  return <span className={`rounded-full px-1.5 text-[9.5px] font-bold leading-4 ${g === "m" ? "bg-primary text-primary-foreground" : "bg-badge text-primary-foreground"}`}>{g === "m" ? "♂" : "♀"}</span>;
}

/** Android bottom sheet. */
export function Sheet({ open, onClose, children, dark, title }: { open: boolean; onClose: () => void; children: ReactNode; dark?: boolean; title?: string }) {
  const close=useRef(onClose); close.current=onClose;
  useEffect(()=>open?pushBack(()=>close.current()):undefined,[open]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop fixed inset-0 z-[60] mx-auto flex max-w-[440px] flex-col justify-end" onClick={onClose}>
      <div className={`sheet-up max-h-[85%] overflow-y-auto rounded-t-[20px] pb-4 ${dark ? "sheet-dark text-night-foreground" : "bg-popover text-foreground"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/30" />
        {title && (
          <div className="flex items-center justify-between px-4 pb-1 pt-2">
            <p className="text-[14px] font-extrabold">{title}</p>
            <button onClick={onClose} aria-label="إغلاق" className="grid h-7 w-7 place-items-center rounded-full opacity-60"><X className="h-4 w-4" /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Android-style action list inside a sheet. */
export function ActionList({ items, onClose }: { items: { label: string; danger?: boolean; onClick: () => void }[]; onClose: () => void }) {
  return (
    <div className="px-3 pt-2">
      <div className="overflow-hidden rounded-2xl bg-secondary">
        {items.map((it) => (
          <button key={it.label} onClick={() => { it.onClick(); onClose(); }} className={`press block w-full border-b border-border/60 py-3 text-center text-[14px] font-bold last:border-0 ${it.danger ? "text-destructive" : "text-navy"}`}>{it.label}</button>
        ))}
      </div>
      <button onClick={onClose} className="press mt-2 block w-full rounded-2xl bg-secondary py-3 text-center text-[14px] font-bold text-muted-foreground">إلغاء</button>
    </div>
  );
}
