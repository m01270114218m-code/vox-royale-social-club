export type Role = "owner" | "admin" | "member";
export type Action = "inviteToMic" | "kickFromMic" | "mute" | "kickFromRoom" | "setAdmin" | "lockSeat" | "clearChat" | "muteAll" | "editRoom";

export const roleLabel: Record<Role, string> = { owner: "مالك الغرفة", admin: "مشرف", member: "عضو" };

/** Room permission rules: owner > admin > member; nobody can act on the owner, admins only act on members. */
export function can(actor: Role, action: Action, target?: Role): boolean {
  switch (action) {
    case "lockSeat":
    case "clearChat":
    case "inviteToMic":
      return actor !== "member";
    case "muteAll":
    case "editRoom":
      return actor === "owner";
    case "setAdmin":
      return actor === "owner" && !!target && target !== "owner";
    case "kickFromMic":
    case "mute":
    case "kickFromRoom":
      if (!target) return false;
      if (actor === "owner") return target !== "owner";
      if (actor === "admin") return target === "member";
      return false;
  }
}

export const permissionTable: { a: Action; n: string }[] = [
  { a: "inviteToMic", n: "دعوة للمايك" },
  { a: "lockSeat", n: "قفل وفتح المقاعد" },
  { a: "mute", n: "كتم مايك عضو" },
  { a: "kickFromMic", n: "إنزال من المايك" },
  { a: "kickFromRoom", n: "طرد من الغرفة" },
  { a: "clearChat", n: "مسح الدردشة" },
  { a: "setAdmin", n: "تعيين وإزالة المشرفين" },
  { a: "muteAll", n: "كتم الجميع" },
  { a: "editRoom", n: "تعديل اسم وإعلان الغرفة" },
];
