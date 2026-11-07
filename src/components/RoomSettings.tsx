import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteMedia, uploadImage, useMedia } from "@/lib/media";
import { CATEGORIES, errMsg } from "@/lib/vox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { roomThemes, roomBackground } from "@/lib/assets3d";

export type EditableRoom = { id: string; name: string; description: string | null; category: string; is_private?: boolean; cover_url?: string | null };

export function RoomSettings({ room, uid, open, onOpenChange, onSaved }: { room: EditableRoom; uid: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (r: EditableRoom) => void }) {
  const [name, setName] = useState(room.name);
  const [desc, setDesc] = useState(room.description ?? "");
  const [cat, setCat] = useState(room.category);
  const [priv, setPriv] = useState(!!room.is_private);
  const [cover, setCover] = useState<string | null>(room.cover_url ?? null);
  const [busy, setBusy] = useState(false);
  const coverUrl = useMedia(cover);

  async function pick(f?: File) {
    if (!f) return;
    try {
      setBusy(true);
      setCover(await uploadImage(f, uid, `room/${room.id}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الرفع");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("update_room", { _room: room.id, _name: name, _description: desc, _category: cat, _country: "EG", _is_private: priv, _cover_url: cover ?? "" });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("تم حفظ إعدادات الغرفة");
    onSaved({ ...room, name: name.trim(), description: desc, category: cat, is_private: priv, cover_url: cover });
    onOpenChange(false);
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader><SheetTitle>إعدادات الغرفة</SheetTitle></SheetHeader>
        <div className="space-y-3 p-4">
          <label className="card-3d relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-secondary">
            <img src={coverUrl || roomBackground(cat)} alt="غلاف الغرفة" className="h-full w-full object-cover" />
            <span className="absolute bottom-2 rounded-full bg-background/70 px-3 py-1 text-xs">تغيير صورة الغرفة</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {roomThemes.map((theme) => <Button key={theme.id} variant="ghost" title={theme.name} aria-label={theme.name} aria-pressed={cover === theme.image} onClick={() => setCover(theme.image)} className={`h-auto flex-col gap-1 p-1 ${cover === theme.image ? "ring-2 ring-primary" : ""}`}><img src={theme.image} alt="" className="aspect-square w-full rounded-md object-cover" /><span className="text-[10px]">{theme.name}</span></Button>)}
          </div>
          <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="اسم الغرفة" />
          <Input value={desc} maxLength={200} onChange={(e) => setDesc(e.target.value)} placeholder="وصف / إعلان الغرفة" />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Button variant="secondary" size="sm" key={c.id} onClick={() => setCat(c.id)} className={`rounded-full ${cat === c.id ? "bg-gold" : "bg-secondary"}`}>{c.name}</Button>
            ))}
          </div>
          <label className="flex items-center justify-between rounded-2xl bg-secondary/50 p-3 text-sm">
            غرفة خاصة (لا تظهر في القائمة)
            <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
          </label>
          <div className="flex gap-2"><Button variant="outline" disabled={busy || !cover} onClick={async () => { if (!cover) return; const previous = cover; setCover(null); try { await supabase.rpc("update_room", { _room: room.id, _name: name, _description: desc, _category: cat, _country: "EG", _is_private: priv, _cover_url: "" }); await deleteMedia(previous).catch(() => undefined); toast.success("تم حذف صورة الغرفة"); } catch (e) { setCover(previous); toast.error(errMsg(e)); } }}>حذف الصورة</Button><Button className="w-full" disabled={busy || name.trim().length < 2} onClick={save}>حفظ</Button></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
