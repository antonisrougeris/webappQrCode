import { locale, localizedPath, t } from "../i18n/locale";
import "./cookieConsent.css";
import { hasAnalyticsConsent, getCookiePreferences, setCookiePreferences } from "../services/cookiePreferences";
import { loadMetaPixel } from "../services/metaPixel";

let initialized = false;

/**
 * Strict opt-in: no Google tag or analytics network request before acceptance.
 * Vite injects this value at frontend BUILD time (CI GitHub Actions variable).
 */
export function loadGoogleAnalytics(): void {
  const measurementId = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
  if (!/^G-[A-Z0-9]{6,}$/i.test(measurementId)) {
    console.warn("Skanare analytics: valid VITE_GA_MEASUREMENT_ID is missing from the frontend build");
    return;
  }
  if (!hasAnalyticsConsent()) return;
  if (document.querySelector('script[data-skanare-ga="true"]')) return;

  window.dataLayer = window.dataLayer || [];
  // gtag.js only interprets the native Arguments object as a command.
  // Pushing a plain array silently drops config and event hits.
  window.gtag = function (..._args: unknown[]): void {
    window.dataLayer.push(arguments);
  };
  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("js", new Date());
  // GA4 automatically logs page_view on each full document navigation.
  window.gtag("config", measurementId, { send_page_view: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  script.dataset.skanareGa = "true";
  script.onerror = () => console.warn("Skanare analytics: Google tag could not load (network or browser blocker)");
  document.head.appendChild(script);
}

export function openCookiePreferences(): void {
  initialized = false;
  document.querySelector(".cookie-banner")?.remove();
  initCookieConsent(true);
}

export function initCookieConsent(forceOpen = false): void {
  // Keep shared initialization safe even if a page runs its entrypoint in <head>.
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", () => initCookieConsent(forceOpen), { once: true });
    return;
  }
  if (initialized) return;
  initialized = true;

  const consent = getCookiePreferences();
  if (!forceOpen && consent) {
    if (consent.analytics) loadGoogleAnalytics();
    if (consent.marketing) loadMetaPixel();
    return;
  }

  const banner = document.createElement("section");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", t("cookies.label", "Cookie preferences"));

  const heading = t("cookies.heading", "Your privacy matters");
  const description = locale === "el"
    ? "Χρησιμοποιούμε απαραίτητα cookies και, μόνο με τη συγκατάθεσή σου, analytics (Google) και διαφημιστικά cookies (Meta). Μπορείς να επιλέξεις."
    : "We use essential cookies and, only with your permission, analytics (Google) and advertising cookies (Meta). You can choose.";
  const policy = t("cookies.policy", "Cookie Policy");
  const reject = t("cookies.reject", "Reject");
  const accept = t("cookies.accept", "Accept");

  banner.innerHTML = `
    <div class="cookie-banner-inner">
      <div class="cookie-banner-icon" aria-hidden="true">🍪</div>
      <div class="cookie-banner-content">
        <strong></strong>
        <p></p>
        <a class="cookie-policy-link"></a>
      </div>
      <div class="cookie-banner-preferences" hidden>
        <label class="cookie-preference"><input type="checkbox" data-cookie-type="analytics"> <span>Google Analytics</span></label>
        <label class="cookie-preference"><input type="checkbox" data-cookie-type="marketing"> <span>Meta advertising</span></label>
        <button type="button" class="cookie-btn cookie-save"></button>
      </div>
      <div class="cookie-banner-actions">
        
        <button type="button" class="cookie-btn cookie-reject"></button>
        <button type="button" class="cookie-btn cookie-accept"></button>
      </div>
    </div>
  `;
  const headingEl = banner.querySelector<HTMLElement>(".cookie-banner-content strong");
  const descriptionEl = banner.querySelector<HTMLElement>(".cookie-banner-content p");
  const link = banner.querySelector<HTMLAnchorElement>(".cookie-policy-link");
  const acceptButton = banner.querySelector<HTMLButtonElement>(".cookie-accept");
  const rejectButton = banner.querySelector<HTMLButtonElement>(".cookie-reject");

  const saveButton = banner.querySelector<HTMLButtonElement>(".cookie-save");
  const preferencesPanel = banner.querySelector<HTMLElement>(".cookie-banner-preferences");
  const analyticsBox = banner.querySelector<HTMLInputElement>('[data-cookie-type="analytics"]');
  const marketingBox = banner.querySelector<HTMLInputElement>('[data-cookie-type="marketing"]');
  if (analyticsBox) analyticsBox.checked = consent?.analytics || false;
  if (marketingBox) marketingBox.checked = consent?.marketing || false;

  if (saveButton) saveButton.textContent = locale === "el" ? "Αποθήκευση" : "Save choices";
  if (forceOpen && preferencesPanel) preferencesPanel.hidden = false;

  if (headingEl) headingEl.textContent = heading;
  if (descriptionEl) descriptionEl.textContent = description;
  if (link) {
    link.textContent = policy;
    link.href = localizedPath("/cookie-policy", locale);
  }
  if (rejectButton) rejectButton.textContent = reject;
  if (acceptButton) acceptButton.textContent = accept;

  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add("cookie-banner-visible"));

  function closeBanner(): void {
    banner.classList.remove("cookie-banner-visible");
    window.setTimeout(() => banner.remove(), 300);
  }

  function commitPreferences(analytics: boolean, marketing: boolean): void {
    if (!setCookiePreferences({ analytics, marketing })) return;
    if (analytics) {
      loadGoogleAnalytics();
      window.dispatchEvent(new Event("skanare:analytics-consent-accepted"));
    }
    if (marketing) {
      loadMetaPixel();
      window.dispatchEvent(new Event("skanare:marketing-consent-accepted"));
    }
    // Reload after withdrawal to prevent already loaded tags from tracking.
    if ((consent?.analytics && !analytics) || (consent?.marketing && !marketing)) {
      window.location.reload();
      return;
    }
    closeBanner();
  }


  saveButton?.addEventListener("click", () => {
    commitPreferences(Boolean(analyticsBox?.checked), Boolean(marketingBox?.checked));
  });
  acceptButton?.addEventListener("click", () => commitPreferences(true, true));
  rejectButton?.addEventListener("click", () => commitPreferences(false, false));
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}
