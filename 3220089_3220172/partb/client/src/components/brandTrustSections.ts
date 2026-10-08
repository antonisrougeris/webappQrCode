import storyAndReviews from "./socialProofSections.html?raw";
import faqHtml from "./socialProofFaq.html?raw";
import { initHomepageSocialProof } from "./homepageSocialProof";
import { translateSubtree } from "../i18n/locale";

type TrustPage = "products" | "productDetails";

/**
 * Append the existing Skanare homepage trust content to store catalog pages.
 * Product details deliberately omit the global customer reviews because
 * that page already includes its own product-specific review module.
 */
export function mountBrandTrustSections(page: TrustPage): void {
  const mount = document.getElementById("skanareTrustSections");
  if (!mount || mount.dataset.initialized === "true") return;

  const template = document.createElement("template");
  template.innerHTML = storyAndReviews + "\n" + faqHtml;

  if (page === "productDetails") {
    template.content.querySelector(".customer-reviews")?.remove();
  }
  mount.replaceChildren(template.content.cloneNode(true));
  mount.dataset.initialized = "true";

  initHomepageSocialProof();
  translateSubtree(mount);
}
