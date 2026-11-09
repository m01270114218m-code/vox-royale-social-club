import { createFileRoute, Link } from "@tanstack/react-router";
import { icons3d, vipBadge } from "@/lib/assets3d";
import { ArrowRight, Car, Check, ChevronLeft, ChevronRight, Crown, Diamond, Flame, Gift, Image as ImageIcon, IdCard, MessageCircle, Shield, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/vox";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/vip")({ component: () => <AppShell><VipPage /></AppShell> });

type VipLevel = {
  lv: number;
  name: string;
  price: number;
  accent: string;
  glow: string;
  subtitle: string;
};

type Perk = {
  code: string;
  name: string;
  description: string;
  min_level: number;
  icon: string;
  sort_order: number;
};

const VIP: VipLevel[] = [
  { lv: 1, name: "KNIGHT", price: 1000, accent: "#39e879", glow: "rgba(57,232,121,.30)", subtitle: "بداية القوة والهوية الملكية" },
  { lv: 2, name: "LORD", price: 3000, accent: "#e5e7eb", glow: "rgba(220,220,220,.25)", subtitle: "هيبة أعلى ومزايا حصرية" },
  { lv: 3, name: "EARL", price: 8000, accent: "#ff8a3d", glow: "rgba(255,138,61,.30)", subtitle: "هوية مميزة ومظهر خاص" },
  { lv: 4, name: "DUKE", price: 20000, accent: "#4f8cff", glow: "rgba(79,140,255,.32)", subtitle: "حماية ومزايا VIP متقدمة" },
  { lv: 5, name: "KING", price: 50000, accent: "#ffd42a", glow: "rgba(255,212,42,.34)", subtitle: "الهيبة الملكية الكاملة" },
  { lv: 6, name: "VIP 6", price: 120000, accent: "#b978ff", glow: "rgba(185,120,255,.35)", subtitle: "أعلى مستوى — كل المميزات" },
];

const FALLBACK_PERKS: Perk[] = [
  { code: "vip_badge", name: "شارة VIP", description: "شارة VIP ثلاثية الأبعاد", min_level: 1, icon: "badge", sort_order: 10 },
  { code: "noble_gifts", name: "هدايا Noble", description: "الوصول إلى هدايا Noble الخاصة", min_level: 1, icon: "gift", sort_order: 20 },
  { code: "diamond_refund", name: "استرداد Diamond", description: "ميزة استرداد الألماس الخاصة بالمستوى", min_level: 1, icon: "diamond", sort_order: 30 },
  { code: "entry_effects", name: "تأثيرات الدخول", description: "تأثير دخول VIP عند دخول الغرفة", min_level: 1, icon: "sparkles", sort_order: 40 },
  { code: "exclusive_head", name: "غطاء رأس حصري", description: "غطاء رأس VIP حصري", min_level: 2, icon: "crown", sort_order: 50 },
  { code: "noble_bubble", name: "فقاعة Noble", description: "فقاعة محادثة Noble خاصة", min_level: 2, icon: "message", sort_order: 60 },
  { code: "special_id", name: "رقم مميز حصري", description: "هوية ورقم مميز", min_level: 2, icon: "id", sort_order: 70 },
  { code: "exclusive_ride", name: "Ride حصري", description: "مركبة VIP حصرية", min_level: 2, icon: "car", sort_order: 80 },
  { code: "exclusive_daimu", name: "Daimu حصري", description: "مظهر Daimu حصري", min_level: 3, icon: "star", sort_order: 90 },
  { code: "exclusive_logo", name: "شعار حصري", description: "شعار VIP حصري", min_level: 3, icon: "crown", sort_order: 100 },
  { code: "exclusive_appearance", name: "مظهر حصري", description: "مظهر شخصي VIP", min_level: 3, icon: "sparkles", sort_order: 110 },
  { code: "mystery_person", name: "الشخص الغامض", description: "هوية ومظهر الشخص الغامض", min_level: 3, icon: "flame", sort_order: 120 },
  { code: "exclusive_start_screen", name: "شاشة بدء حصرية", description: "شاشة بدء VIP خاصة", min_level: 4, icon: "image", sort_order: 130 },
  { code: "kick_protection", name: "الحماية من الطرد", description: "حماية حقيقية على مستوى قاعدة البيانات", min_level: 4, icon: "shield", sort_order: 140 },
  { code: "advanced_entry", name: "تأثير دخول متقدم", description: "تأثير دخول متقدم", min_level: 4, icon: "sparkles", sort_order: 150 },
  { code: "enhanced_noble_gifts", name: "هدايا Noble محسّنة", description: "مزايا هدايا Noble محسّنة", min_level: 4, icon: "gift", sort_order: 160 },
  { code: "mute_protection", name: "الحماية من الكتم", description: "حماية حقيقية على مستوى قاعدة البيانات", min_level: 5, icon: "shield", sort_order: 170 },
  { code: "royal_badge", name: "شارة ملكية حصرية", description: "شارة ملكية متقدمة", min_level: 5, icon: "crown", sort_order: 180 },
  { code: "royal_appearance", name: "مظهر ملكي متقدم", description: "هوية ومظهر ملكي متقدم", min_level: 5, icon: "sparkles", sort_order: 190 },
  { code: "vip_priority", name: "أولوية مزايا VIP", description: "أولوية مزايا VIP", min_level: 5, icon: "star", sort_order: 200 },
  { code: "vip6_badge", name: "شارة VIP 6", description: "شارة المستوى الأعلى", min_level: 6, icon: "crown", sort_order: 210 },
  { code: "full_royal_perks", name: "كل المميزات", description: "يفتح جميع مميزات VIP", min_level: 6, icon: "crown", sort_order: 220 },
  { code: "vip6_exclusive", name: "مميزات VIP 6 الحصرية", description: "مميزات إضافية حصرية لأعلى مستوى", min_level: 6, icon: "sparkles", sort_order: 230 },
];

const perkIcons: Record<string, typeof Crown> = {
  crown: Crown, badge: Crown, gift: Gift, diamond: Diamond, sparkles: Sparkles,
  shield: Shield, car: Car, id: IdCard, flame: Flame, image: ImageIcon, message: MessageCircle, star: Star,
};

function PerkIcon({ type, color }: { type: string; color: string }) {
  const Icon = perkIcons[type] ?? Sparkles;
  return <Icon className="h-5 w-5" style={{ color }} />;
}

function VipPage() {
  const { user } = useAuth();
  const [level, setLevel] = useState(0);
  const [selected, setSelected] = useState(1);
  const [perks, setPerks] = useState<Perk[]>(FALLBACK_PERKS);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [{ data: profile }, { data: dbPerks }] = await Promise.all([
        supabase.from("profiles").select("vip_level").eq("id", user.id).single(),
        supabase.from("vip_perks").select("code,name,description,min_level,icon,sort_order").order("sort_order"),
      ]);
      if (!alive) return;
      const current = Number(profile?.vip_level ?? 0);
      setLevel(current);
      setSelected(Math.min(6, Math.max(1, current || 1)));
      if (dbPerks?.length) setPerks(dbPerks as Perk[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const tier = VIP[selected - 1];
  const availablePerks = useMemo(
    () => perks.filter((p) => p.min_level <= selected).sort((a, b) => a.sort_order - b.sort_order),
    [perks, selected],
  );
  const newlyUnlocked = useMemo(
    () => perks.filter((p) => p.min_level === selected).sort((a, b) => a.sort_order - b.sort_order),
    [perks, selected],
  );

  async function buy(lv: number) {
    setBuying(true);
    const { error } = await supabase.rpc("buy_vip", { _level: lv });
    setBuying(false);
    if (error) {
      toast.error(error.message.includes("insufficient") ? "رصيد العملات غير كافٍ" : errMsg(error));
      return;
    }
    setLevel(lv);
    setSelected(lv);
    toast.success(`مبروك! أصبحت ${VIP[lv - 1].name} 👑`);
  }

  const move = (dir: number) => setSelected((v) => Math.min(6, Math.max(1, v + dir)));

  return (
    <div dir="rtl" className="min-h-full px-3 pt-3 pb-10" style={{ background: `radial-gradient(circle at 50% 4%, ${tier.glow}, transparent 34%), linear-gradient(180deg,#05080e 0%,#090b12 45%,#030407 100%)` }}>
      <div className="sticky top-0 z-20 mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-2 py-2 backdrop-blur-xl">
        <Link to="/profile" className="rounded-full border border-white/10 bg-white/5 p-2"><ArrowRight className="h-5 w-5" /></Link>
        <div className="text-center">
          <div className="text-[9px] font-black tracking-[.35em] text-white/45">VIP ROYALE</div>
          <h1 className="text-xl font-black" style={{ color: tier.accent }}>VIP</h1>
        </div>
        <img src={icons3d.vip} alt="" className="h-10 w-10 object-contain" />
      </div>

      <div className="mb-3 flex items-center justify-center gap-1">
        <button onClick={() => move(-1)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70"><ChevronRight className="h-5 w-5" /></button>
        <div className="flex flex-1 gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
          {VIP.map((v) => (
            <button key={v.lv} onClick={() => setSelected(v.lv)} className="min-w-[76px] rounded-xl border px-2 py-2 text-[10px] font-black transition-all" style={{ color: selected === v.lv ? v.accent : "rgba(255,255,255,.42)", borderColor: selected === v.lv ? v.accent + "99" : "rgba(255,255,255,.08)", background: selected === v.lv ? v.glow : "rgba(255,255,255,.025)", boxShadow: selected === v.lv ? `0 0 18px ${v.glow}` : "none" }}>{v.name}</button>
          ))}
        </div>
        <button onClick={() => move(1)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70"><ChevronLeft className="h-5 w-5" /></button>
      </div>

      <div className="relative overflow-hidden rounded-[30px] border p-4 shadow-2xl" style={{ borderColor: tier.accent + "70", background: `linear-gradient(135deg, ${tier.glow}, rgba(4,7,12,.94) 58%)`, boxShadow: `0 0 55px ${tier.glow}` }}>
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full blur-3xl" style={{ background: tier.glow }} />
        <div className="absolute -left-20 bottom-0 h-40 w-40 rounded-full blur-3xl" style={{ background: tier.glow }} />
        <div className="relative flex min-h-[245px] items-center justify-between gap-2">
          <div className="w-[45%]">
            <div className="text-[11px] font-bold text-white/45">المستوى</div>
            <div className="mt-1 text-4xl font-black leading-none" style={{ color: tier.accent }}>{tier.name}</div>
            <div className="mt-3 text-xs leading-5 text-white/60">{tier.subtitle}</div>
            <div className="mt-4 inline-flex rounded-full border px-3 py-2 text-[10px] font-black" style={{ borderColor: tier.accent + "70", color: tier.accent, background: tier.glow }}>
              {level === tier.lv ? "مفعّل الآن" : level > tier.lv ? "مفتوح" : "غير مفعّل"}
            </div>
          </div>
          <div className="flex w-[55%] justify-center">
            <img src={vipBadge(tier.lv)} alt={tier.name} className="h-56 w-56 object-contain drop-shadow-2xl" />
          </div>
        </div>
        <div className="relative mt-1 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
          <span className="text-[10px] text-white/45">المميزات المتاحة حتى هذا المستوى</span>
          <span className="text-sm font-black" style={{ color: tier.accent }}>{availablePerks.length} ميزة</span>
        </div>
      </div>

      {newlyUnlocked.length > 0 && (
        <section className="mt-3 rounded-[26px] border p-3" style={{ borderColor: tier.accent + "50", background: "rgba(255,255,255,.035)" }}>
          <div className="mb-2 text-center text-sm font-black" style={{ color: tier.accent }}>✦ مميزات {tier.name} الجديدة ✦</div>
          <div className="grid grid-cols-2 gap-2">
            {newlyUnlocked.map((perk) => (
              <div key={perk.code} className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center" style={{ borderColor: tier.accent + "35", background: tier.glow }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: tier.accent + "70" }}><PerkIcon type={perk.icon} color={tier.accent} /></div>
                <div className="text-[11px] font-black text-white">{perk.name}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-3 rounded-[28px] border border-white/10 bg-black/30 p-3 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black tracking-widest text-white/40">VIP PERMISSIONS</div>
            <h2 className="text-lg font-black" style={{ color: tier.accent }}>المميزات والصلاحيات</h2>
          </div>
          <Shield className="h-6 w-6" style={{ color: tier.accent }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {availablePerks.map((perk) => (
            <div key={perk.code} className="rounded-2xl border border-white/10 bg-white/[.035] p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: tier.accent + "55", background: tier.glow }}><PerkIcon type={perk.icon} color={tier.accent} /></div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-black text-white">{perk.name}</div>
                  <div className="mt-0.5 text-[9px] font-bold" style={{ color: tier.accent }}>VIP {perk.min_level}+</div>
                </div>
                <Check className="mr-auto h-4 w-4 shrink-0" style={{ color: tier.accent }} />
              </div>
              <p className="mt-2 text-[10px] leading-4 text-white/45">{perk.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-3 rounded-[26px] border p-4" style={{ borderColor: tier.accent + "60", background: `linear-gradient(180deg,${tier.glow},rgba(0,0,0,.55))` }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-white/45">سعر التفعيل</div>
            <div className="mt-1 text-2xl font-black" style={{ color: tier.accent }}>{tier.price.toLocaleString()} <span className="text-xs">عملة</span></div>
          </div>
          <img src={icons3d.coin} alt="" className="h-16 w-16 object-contain drop-shadow-xl" />
        </div>
        <Button className="w-full rounded-2xl py-6 text-base font-black shadow-lg" style={{ background: tier.accent, color: "#111" }} disabled={loading || buying || level >= tier.lv} onClick={() => buy(tier.lv)}>
          {level >= tier.lv ? "مفعّل" : buying ? "جارٍ التفعيل..." : `تفعيل ${tier.name} الآن`}
        </Button>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-[10px] leading-5 text-white/40">
        الصلاحيات الحساسة مثل الحماية من الطرد والكتم يتم التحقق منها على مستوى قاعدة البيانات، وليست مجرد عرض داخل الواجهة.
      </div>
    </div>
  );
}
