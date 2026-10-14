/**
 * One versioned cookie decision for both analytics and advertising.
 * Legacy "skanare_cookie_consent=accepted" covered analytics only and MUST
 * NOT authorize Meta or silently be upgraded to marketing consent.
 */
export const COOKIE_PREFERENCES_KEY = "skanare_cookie_consent_v2";
export const COOKIE_PREFERENCES_VERSION = 2 as const;
export interface CookiePreferences {
  version: typeof COOKIE_PREFERENCES_VERSION;
  analytics: boolean;
  marketing: boolean;
}

export function getCookiePreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      (value as CookiePreferences).version !== COOKIE_PREFERENCES_VERSION ||
      typeof (value as CookiePreferences).analytics !== "boolean" ||
      typeof (value as CookiePreferences).marketing !== "boolean"
    ) return null;
    const { analytics, marketing } = value as CookiePreferences;
    return { version: 2, analytics, marketing };
  } catch { return null; }
}

export function setCookiePreferences(options: { analytics: boolean; marketing: boolean }): boolean {
  try {
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify({
      version: COOKIE_PREFERENCES_VERSION,
      analytics: options.analytics,
      marketing: options.marketing
    }));
    return true;
  } catch { return false; }
}

export function hasAnalyticsConsent(): boolean {
  return getCookiePreferences()?.analytics === true;
}

export function hasMarketingConsent(): boolean {
  return getCookiePreferences()?.marketing === true;
}
