/** Opening ad shown once per app launch; the admin picks it in the control panel. */
export const SPLASH_SECONDS = 5;

type Setting = { key: string; value: unknown };
type Asset = { id: string; url: string; mime: string | null };

/** The ad to show, or null when the admin turned it off or its file is missing. */
export function splashAd(settings: readonly Setting[], assets: readonly Asset[]): { url: string; mime: string | null } | null {
  const v = settings.find(s => s.key === 'splash')?.value;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o['enabled'] !== true || typeof o['asset_id'] !== 'string') return null;
  const a = assets.find(x => x.id === o['asset_id']);
  return a?.url ? { url: a.url, mime: a.mime } : null;
}
