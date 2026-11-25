import { useEffect, useRef, useState } from 'react';
import { Music2, Plus, Play, Pause, SkipBack, SkipForward, Trash2, Volume2, Repeat, Shuffle } from 'lucide-react';
import { Sheet } from './ui';
import { toast } from './toast';
import { useCloudState } from './cloud-state';

type Track = { id: string; name: string; url: string; mine: boolean };
const fmt = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;

/** Room music player: songs published by the administration plus songs added from the device. */
export function RoomMusic({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { catalog } = useCloudState();
  const [local, setLocal] = useState<Track[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const urls = useRef<string[]>([]);
  const wantPlay = useRef(false);
  const published: Track[] = catalog.filter(c => c.kind === 'music' && c.enabled && c.url).map(c => ({ id: c.id, name: c.name, url: c.url, mine: false }));
  const tracks = [...published, ...local];
  const index = Math.max(0, tracks.findIndex(t => t.id === currentId));
  const current = tracks.find(t => t.id === currentId) ?? null;
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  const play = async () => { const el = audio.current; if (!el) return; try { await el.play(); } catch { toast('تعذّر تشغيل الملف؛ جرّب MP3 أو M4A أو WAV'); setPlaying(false); } };
  const select = (id: string) => { wantPlay.current = true; setTime(0); setDuration(0); if (id === currentId) void play(); else setCurrentId(id); };
  const step = (delta: number) => { if (!tracks.length) return; const next = shuffle && tracks.length > 1 ? (index + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length : (index + delta + tracks.length) % tracks.length; select(tracks[next]!.id); };
  const add = (files: File[]) => {
    const added = files.filter(f => f.type.startsWith('audio') || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(f.name)).map(file => { const url = URL.createObjectURL(file); urls.current.push(url); return { id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ''), url, mine: true }; });
    if (!added.length) { toast('اختر ملفات صوتية'); return; }
    setLocal(t => [...t, ...added]);
    if (!current) select(added[0]!.id);
  };
  const remove = (id: string) => { if (id === currentId) { audio.current?.pause(); setCurrentId(null); } setLocal(t => t.filter(x => x.id !== id)); };
  return <>
    <audio ref={audio} src={current?.url} loop={repeat} onCanPlay={() => { if (wantPlay.current) { wantPlay.current = false; void play(); } }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onLoadedMetadata={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onEnded={() => step(1)} onError={() => { if (current) toast('تعذّر تشغيل الملف على هذا الجهاز'); }} />
    <Sheet open={open} onClose={onClose} dark title="موسيقى الغرفة"><div className="space-y-4 px-4 pt-1">
      <div className="flex items-center gap-3.5">
        <span className={`music-disc relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full ${playing ? 'music-disc-on' : ''}`}><Music2 className="h-5 w-5 text-gold" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold text-gold">{playing ? 'يُشغَّل الآن' : current ? 'متوقف مؤقتاً' : 'اختر أغنية'}</p>
          <p className="truncate text-[15px] font-black">{current?.name ?? 'قائمة الأغاني'}</p>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] opacity-80" dir="ltr"><span className="w-7 text-end">{fmt(time)}</span><input aria-label="موضع الأغنية" type="range" min="0" max={duration || 1} value={time} step="0.1" disabled={!duration} className="min-w-0 flex-1 accent-[var(--gold)]" onChange={e => { if (audio.current) audio.current.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }} /><span className="w-7">{fmt(duration)}</span></div>
        </div>
      </div>
      <div className="flex items-center justify-between px-2" dir="ltr">
        <button type="button" aria-label="تشغيل عشوائي" aria-pressed={shuffle} onClick={() => setShuffle(v => !v)} className={`press grid h-9 w-9 place-items-center rounded-full ${shuffle ? 'text-gold' : 'opacity-60'}`}><Shuffle className="h-4 w-4" /></button>
        <button type="button" aria-label="الأغنية السابقة" disabled={!tracks.length} onClick={() => step(-1)} className="press grid h-10 w-10 place-items-center rounded-full night-glass disabled:opacity-40"><SkipBack className="h-[18px] w-[18px]" /></button>
        <button type="button" aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'} disabled={!tracks.length} onClick={() => { if (playing) audio.current?.pause(); else if (current) void play(); else select(tracks[0]!.id); }} className="press grid h-14 w-14 place-items-center rounded-full gold-bg text-navy shadow-lg disabled:opacity-50">{playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-0.5" />}</button>
        <button type="button" aria-label="الأغنية التالية" disabled={!tracks.length} onClick={() => step(1)} className="press grid h-10 w-10 place-items-center rounded-full night-glass disabled:opacity-40"><SkipForward className="h-[18px] w-[18px]" /></button>
        <button type="button" aria-label="تكرار الأغنية" aria-pressed={repeat} onClick={() => setRepeat(v => !v)} className={`press grid h-9 w-9 place-items-center rounded-full ${repeat ? 'text-gold' : 'opacity-60'}`}><Repeat className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-3 rounded-full night-glass px-3 py-2"><Volume2 className="h-4 w-4 shrink-0 text-ice" /><input aria-label="مستوى الصوت" type="range" min="0" max="1" step="0.01" value={volume} className="min-w-0 flex-1 accent-[var(--gold)]" onChange={e => setVolume(Number(e.target.value))} dir="ltr" /><span className="w-8 text-[10.5px] font-bold" dir="ltr">{Math.round(volume * 100)}%</span></div>
      <div className="flex items-center justify-between"><p className="text-[13px] font-black">القائمة ({tracks.length})</p><button type="button" onClick={() => input.current?.click()} className="press flex h-8 items-center gap-1 rounded-full gold-bg px-3 text-[12px] font-black text-navy"><Plus className="h-3.5 w-3.5" strokeWidth={3} />إضافة من الجهاز</button></div>
      <input ref={input} aria-label="ملفات الأغاني" className="hidden" type="file" multiple accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus" onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      <div className="max-h-56 space-y-1.5 overflow-y-auto pb-1">
        {tracks.map((t, i) => { const on = t.id === currentId; return <div key={t.id} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${on ? 'bg-night-foreground/15 ring-1 ring-gold/60' : 'night-glass'}`}>
          <button type="button" onClick={() => select(t.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-black ${on ? 'gold-bg text-navy' : 'bg-night-foreground/10'}`}>{on && playing ? <span className="eq"><i /><i /><i /></span> : i + 1}</span>
            <span className="min-w-0"><span className={`block truncate text-[12.5px] font-bold ${on ? 'text-gold' : ''}`}>{t.name}</span><span className="block text-[10px] opacity-60">{t.mine ? 'من جهازك' : 'من مكتبة التطبيق'}</span></span>
          </button>
          {t.mine && <button type="button" aria-label={`حذف ${t.name}`} onClick={() => remove(t.id)} className="press grid h-8 w-8 shrink-0 place-items-center rounded-full opacity-70"><Trash2 className="h-4 w-4" /></button>}
        </div>; })}
        {!tracks.length && <p className="py-8 text-center text-[12px] opacity-70">لا توجد أغانٍ بعد؛ أضف أغاني من جهازك</p>}
      </div>
    </div></Sheet>
  </>;
}
