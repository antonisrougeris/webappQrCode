import {
  initLocalization,
} from "./locale";
import { initCookieConsent } from "../components/cookieConsent";

function start(): void {
  initLocalization();
  initCookieConsent();
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    start,
    { once: true }
  );
} else {
  start();
}
