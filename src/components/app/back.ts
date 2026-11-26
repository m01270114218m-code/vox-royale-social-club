/** Stack of "close me" handlers for open sheets/dialogs, so the phone back button closes the top one first. */
const stack: (() => void)[] = [];
export function pushBack(fn: () => void): () => void {
  stack.push(fn);
  return () => { const i = stack.lastIndexOf(fn); if (i >= 0) stack.splice(i, 1); };
}
/** Runs the top handler; false when nothing is open. */
export function popBack(): boolean {
  const fn = stack.pop();
  if (!fn) return false;
  fn();
  return true;
}
export type BackStep = "close" | "back" | "home" | "exit-hint" | "exit";
/** What the phone back button does: close an open sheet, else go back one page, else return home, and only exit from home on a second press. */
export function backStep(o: { hasSheet: boolean; path: string; canGoBack: boolean; pressedRecently: boolean }): BackStep {
  if (o.hasSheet) return "close";
  if (o.path === "/" || o.path === "/login") return o.pressedRecently ? "exit" : "exit-hint";
  return o.canGoBack ? "back" : "home";
}
export const hasBack = () => stack.length > 0;
