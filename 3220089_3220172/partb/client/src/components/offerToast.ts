import { locale } from "../i18n/locale";
import "./offerToast.css";

/**
 * A lightweight, non-modal offer for people browsing products.
 * The existing store checkout validates SKANARE10 as the active 10% code.
 * Show once per tab/session after 40 seconds across eligible pages.
 */
export const OFFER_CODE = "SKANARE10";
export const OFFER_DELAY_MS = 40_000;
export const OFFER_VISIBLE_SECONDS = 15;
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
  let countdownTimer: number | undefined;
  let activeKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  let closed = false;

  function dismiss(toast: HTMLElement): void {
    if (closed) return;
    closed = true;
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
    if (activeKeyHandler) document.removeEventListener("keydown", activeKeyHandler);
    activeKeyHandler = null;
    toast.classList.remove("offer-toast--visible");
    toast.classList.add("offer-toast--leaving");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 450);
  }

  async function copyCode(button: HTMLButtonElement, code: HTMLElement, toast: HTMLElement): Promise<void> {
    button.disabled = true;
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
      // No confirmation overlay: the successful Copy action dismisses immediately.
      dismiss(toast);
    } else {
      button.disabled = false;
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
        <div class="offer-toast__controls">
          <button class="offer-toast__close" type="button" aria-label="${greek ? "Κλείσιμο προσφοράς" : "Dismiss offer"}">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
          <span class="offer-toast__timer" aria-label="${greek ? "Κλείνει σε 15 δευτερόλεπτα" : "Closes in 15 seconds"}" aria-live="off">15s</span>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    sessionSet(SHOWN_KEY, "1");
    window.requestAnimationFrame(() => toast.classList.add("offer-toast--visible"));

    const close = toast.querySelector<HTMLButtonElement>(".offer-toast__close");
    const copy = toast.querySelector<HTMLButtonElement>(".offer-toast__copy");
    const code = toast.querySelector<HTMLElement>(".offer-toast__code");
    close?.addEventListener("click", () => dismiss(toast));
    if (copy && code) copy.addEventListener("click", () => { void copyCode(copy, code, toast); });
    activeKeyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && toast.isConnected) dismiss(toast);
    };
    document.addEventListener("keydown", activeKeyHandler);

    // Time-based, rather than decrementing on each tick: remains accurate
    // even if the browser briefly throttles timers or the tab is backgrounded.
    const deadline = Date.now() + OFFER_VISIBLE_SECONDS * 1000;
    const counter = toast.querySelector<HTMLElement>(".offer-toast__timer");
    function updateCountdown(): void {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (counter) counter.textContent = `${remaining}s`;
      if (remaining === 0) dismiss(toast);
    }
    updateCountdown();
    countdownTimer = window.setInterval(updateCountdown, 250);
  }

  retryTimer = window.setTimeout(show, Math.max(0, OFFER_DELAY_MS - (Date.now() - started)));
}
