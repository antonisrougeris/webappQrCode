import "../../i18n/auto";
import { openCookiePreferences } from "../../components/cookieConsent";
import { initLayout } from "../../components/initLayout";

initLayout();
document.getElementById("openCookiePreferences")?.addEventListener("click", () => openCookiePreferences());