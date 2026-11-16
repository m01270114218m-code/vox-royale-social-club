export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "EG", name: "مصر", flag: "🇪🇬" },
  { code: "SA", name: "السعودية", flag: "🇸🇦" },
  { code: "AE", name: "الإمارات", flag: "🇦🇪" },
  { code: "QA", name: "قطر", flag: "🇶🇦" },
  { code: "YE", name: "اليمن", flag: "🇾🇪" },
  { code: "IQ", name: "العراق", flag: "🇮🇶" },
  { code: "MA", name: "المغرب", flag: "🇲🇦" },
  { code: "DZ", name: "الجزائر", flag: "🇩🇿" },
  { code: "JO", name: "الأردن", flag: "🇯🇴" },
  { code: "KW", name: "الكويت", flag: "🇰🇼" },
];
export const flagOf = (c?: string | null) => COUNTRIES.find((x) => x.code === c)?.flag ?? "🌍";

export const CATEGORIES = [
  { id: "chat", name: "دردشة" },
  { id: "music", name: "غناء" },
  { id: "friends", name: "تعارف" },
  { id: "games", name: "ألعاب" },
  { id: "poetry", name: "شعر" },
];
export const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

export const SEAT_OPTIONS = [4, 6, 8, 9, 12, 16] as const;

export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  const map: Record<string, string> = {
    "seat taken": "المقعد مشغول",
    "seat locked": "المقعد مقفول",
    "join the room first": "ادخل الغرفة أولاً",
    banned: "أنت محظور من هذه الغرفة",
    "not allowed": "ليس لديك صلاحية",
    "slow down": "أرسلت رسائل كثيرة، انتظر قليلاً",
    "max 3 rooms per user": "الحد الأقصى 3 غرف لكل مستخدم",
    "cannot ban owner": "لا يمكن حظر صاحب الغرفة",
    "cannot_ban_owner": "لا يمكن تنفيذ الإجراء على صاحب الغرفة",
    "cannot_kick_owner": "لا يمكن طرد صاحب الغرفة",
    "cannot_moderate_owner": "لا يمكن إدارة صاحب الغرفة",
    "cannot_moderate_peer": "لا يمكنك إدارة مشرف آخر",
    "owner_only": "تعيين المشرفين متاح لصاحب الغرفة فقط",
    "user_not_in_room": "المستخدم لم يعد داخل الغرفة",
    "already_on_mic": "المستخدم موجود بالفعل على المايك",
    "no_free_mic": "لا يوجد مايك مفتوح متاح",
    "kicked_24h": "تم طردك مؤقتاً؛ يمكنك العودة بعد 24 ساعة",
    "chat_muted": "تم منعك من الكتابة في شات الغرفة",
    "insufficient coins": "رصيدك من العملات غير كافٍ",
    "cannot gift yourself": "لا يمكنك إهداء نفسك",
    "already claimed": "استلمت مكافأتك اليوم، عد غداً",
    "gift unavailable": "الهدية غير متاحة",
    "vip_kick_protected": "هذا المستخدم محمي من الطرد بسبب مستوى VIP",
    "vip_mute_protected": "هذا المستخدم محمي من الكتم بسبب مستوى VIP",
  };
  for (const k of Object.keys(map)) if (m.includes(k)) return map[k] ?? m;
  return m;
}
