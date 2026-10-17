import { locale } from "../i18n/locale";
import "./offerToast.css";

/**
 * A lightweight, non-modal offer for people browsing products.
 * The existing store checkout validates SKANARE10 as the active 10% code.
 * Show once per tab/session after 40 seconds across eligible pages.
 */
export const OFFER_CODE = "SKANARE10";
export const OFFER_DELAY_MS = 40_000;
const START_KEY = "skanare_offer_session_started_v1";
const SHOWN_KEY = "skanare_offer_toast_shown_v1";
let initialized = false;

function sessionGet(key: string): string | null {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}
function sessionSet(key: string, value: string): void {
  try { window.sessionStorage.setItem(key, value); } catch { /* Storage might be disabled. */ }
}

export function isOfferPage(pathname: string): boolean {
  return /^\/(?:el\/)?(?:$|products\/?$|product\/[^/]+\/?$|src\/pages\/products\/products\.html$|src\/pages\/product-details\/product-details\.html$)/i.test(pathname);
}

export function initOfferToast(): void {
  if (initialized || !isOfferPage(window.location.pathname) || !document.body) return;
  initialized = true;

  if (sessionGet(SHOWN_KEY) === "1") return;

  const previousStart = Number(sessionGet(START_KEY));
  const started = Number.isFinite(previousStart) && previousStart > 0 && previousStart <= Date.now()
    ? previousStart : Date.now();
  sessionSet(START_KEY, String(started));

  const greek = locale === "el";
  let retryTimer: number | undefined;
  let dismissTimer: number | undefined;
  let closed = false;

  function dismiss(toast: HTMLElement): void {
    if (closed) return;
    closed = true;
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    if (dismissTimer !== undefined) window.clearTimeout(dismissTimer);
    toast.classList.remove("offer-toast--visible");
    toast.classList.add("offer-toast--leaving");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 450);
  }

  async function copyCode(button: HTMLButtonElement, code: HTMLElement): Promise<void> {
    let copied = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(OFFER_CODE);
      copied = true;
    } catch {
      const field = document.createElement("textarea");
      field.value = OFFER_CODE;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      field.remove();
    }
    if (copied) {
      button.textContent = greek ? "Αντιγράφηκε ✓" : "Copied ✓";
      button.classList.add("offer-toast__copy--done");
      sessionSet(SHOWN_KEY, "1");
    } else {
      button.textContent = greek ? "Επίλεξε κωδικό" : "Select code";
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  function show(): void {
    if (closed || document.getElementById("skanareOfferToast")) return;
    // Never compete with checkout, cookie consent, drawers or dialogs.
    if (document.visibilityState !== "visible" ||
        document.querySelector(".cookie-banner, .cart-drawer.open, .promo-overlay:not(.hidden), dialog[open], .boxnow-modal.is-open")) {
      retryTimer = window.setTimeout(show, 1500);
      return;
    }

    const toast = document.createElement("aside");
    toast.id = "skanareOfferToast";
    toast.className = "offer-toast";
    toast.setAttribute("role", "region");
    toast.setAttribute("aria-label", greek ? "Έκπτωση Skanare" : "Skanare discount");
    toast.innerHTML = `
      <div class="offer-toast__body">
        <span class="offer-toast__icon" aria-hidden="true">%</span>
        <div class="offer-toast__content">
          <div class="offer-toast__eyebrow">${greek ? "ΜΙΑ ΜΙΚΡΗ ΕΚΠΤΩΣΗ ΓΙΑ ΣΕΝΑ" : "A LITTLE SOMETHING FOR YOU"}</div>
          <strong class="offer-toast__title">${greek ? "Μην το πολυσκέφτεσαι." : "Still thinking it over?"}</strong>
          <p>${greek ? "Κέρδισε 10% στην παραγγελία σου." : "Enjoy 10% off your order."}</p>
          <div class="offer-toast__actions">
            <code class="offer-toast__code">${OFFER_CODE}</code>
            <button class="offer-toast__copy" type="button">${greek ? "Αντιγραφή" : "Copy code"}</button>
          </div>
        </div>
        <button class="offer-toast__close" type="button" aria-label="${greek ? "Κλείσιμο προσφοράς" : "Dismiss offer"}">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(toast);
    sessionSet(SHOWN_KEY, "1");
    window.requestAnimationFrame(() => toast.classList.add("offer-toast--visible"));

    const close = toast.querySelector<HTMLButtonElement>(".offer-toast__close");
    const copy = toast.querySelector<HTMLButtonElement>(".offer-toast__copy");
    const code = toast.querySelector<HTMLElement>(".offer-toast__code");
    close?.addEventListener("click", () => dismiss(toast));
    if (copy && code) copy.addEventListener("click", () => { void copyCode(copy, code); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && toast.isConnected) dismiss(toast);
    }, { once: false });

    // Automatically clear the screen, but don't disappear during interaction.
    function autoDismiss(): void {
      if (toast.matches(":hover") || toast.contains(document.activeElement)) {
        dismissTimer = window.setTimeout(autoDismiss, 4000);
        return;
      }
      dismiss(toast);
    }
    dismissTimer = window.setTimeout(autoDismiss, 16_000);
  }

  retryTimer = window.setTimeout(show, Math.max(0, OFFER_DELAY_MS - (Date.now() - started)));
}
