import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage, useMedia } from "@/lib/media";
import { CATEGORIES, errMsg } from "@/lib/vox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
      setCover(await uploadImage(f, uid));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الرفع");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("update_room", { _room: room.id, _name: name, _description: desc, _category: cat, _is_private: priv, _cover_url: cover ?? "" });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
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
            {coverUrl ? <img src={coverUrl} alt="غلاف الغرفة" className="h-full w-full object-cover" /> : <ImagePlus className="h-8 w-8 text-muted-foreground" />}
            <span className="absolute bottom-2 rounded-full bg-background/70 px-3 py-1 text-xs">تغيير صورة الغرفة</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="اسم الغرفة" />
          <Input value={desc} maxLength={200} onChange={(e) => setDesc(e.target.value)} placeholder="وصف / إعلان الغرفة" />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-full px-3 py-1 text-sm ${cat === c.id ? "bg-gold" : "bg-secondary"}`}>{c.name}</button>
            ))}
          </div>
          <label className="flex items-center justify-between rounded-2xl bg-secondary/50 p-3 text-sm">
            غرفة خاصة (لا تظهر في القائمة)
            <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
          </label>
          <Button className="w-full" disabled={busy || name.trim().length < 2} onClick={save}>حفظ</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
