import type { ReactNode } from "react";

export const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}س ${m}د` : `${m}د`;
};

export function Locked({ title, text, img }: { title: string; text: string; img: string }) {
  return (
    <div className="flex flex-col items-center px-8 pt-16 text-center">
      <img src={img} alt="" className="h-28 w-28 opacity-90 grayscale-[35%] drop-shadow-lg" />
      <p className="mt-4 text-[17px] font-black text-navy">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{text}</p>
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="surface p-3">
      <div className="mb-2 flex items-center justify-between"><p className="text-[13.5px] font-extrabold text-navy">{title}</p>{right}</div>
      {children}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-secondary shadow transition-all ${on ? "right-0.5" : "right-[22px]"}`} />
    </button>
  );
}
