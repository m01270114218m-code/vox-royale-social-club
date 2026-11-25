import { bubbles, type BubbleKey } from './data';
export function ChatText({bubble,text}:{bubble:BubbleKey;text:string}) {
  if(bubble==='none')return <p className="chat-plain mt-0.5 max-w-[265px] break-words text-[13px] leading-relaxed">{text}</p>;
  const art=bubbles[bubble];
  return <div className="chat-art-bubble relative isolate mt-1 w-fit min-w-28 max-w-[255px] break-words px-5 py-4 text-[13px] font-semibold leading-relaxed text-navy">
    {art?.img&&<img src={art.img} alt="" className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-fill"/>}
    <span>{text}</span>
  </div>;
}