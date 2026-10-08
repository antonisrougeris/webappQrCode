import { locale, localizedPath, t } from "../i18n/locale";

const COOKIE_CONSENT_KEY = "skanare_cookie_consent";
type CookieConsent = "accepted" | "rejected";
let initialized = false;

function getConsent(): CookieConsent | null {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    return stored === "accepted" || stored === "rejected" ? stored : null;
  } catch {
    // Privacy modes can disable storage. Ask on the current page instead.
    return null;
  }
}

function saveConsent(value: CookieConsent): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // A storage-restricted browser can still use the site normally.
  }
}

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

export function initCookieConsent(): void {
  // Keep shared initialization safe even if a page runs its entrypoint in <head>.
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", initCookieConsent, { once: true });
    return;
  }
  if (initialized) return;
  initialized = true;

  const consent = getConsent();
  if (consent === "accepted") {
    loadGoogleAnalytics();
    return;
  }
  if (consent === "rejected") return;

  const banner = document.createElement("section");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", t("cookies.label", "Cookie preferences"));

  const heading = t("cookies.heading", "Your privacy matters");
  const description = t("cookies.description", "We use essential cookies and optional analytics to improve Skanare. Analytics runs only if you accept.");
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

  acceptButton?.addEventListener("click", () => {
    saveConsent("accepted");
    loadGoogleAnalytics();
    closeBanner();
  }, { once: true });

  rejectButton?.addEventListener("click", () => {
    saveConsent("rejected");
    closeBanner();
  }, { once: true });
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}
