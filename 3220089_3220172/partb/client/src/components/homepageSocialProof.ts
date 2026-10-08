import { t, locale, productPath } from "../i18n/locale";
import { apiRequest } from "../services/api";
import { homepageReels, type SkanareReel } from "../config/socialProof";

type Order = "featured" | "newest" | "highest" | "lowest";
type PublicReview = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  verifiedPurchase?: boolean;
  createdAt?: string;
  productId?: string;
  productTitle?: string;
  productImage?: string;
  productSlug?: string;
  featured?: boolean;
};
const previewOnly = import.meta.env.DEV;
const tx = (key: string, english: string) => t("social." + key, english);

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = "", value?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

const instagramSvg = '<svg viewBox="0 0 24 24" width="31" height="31" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="6"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
const filterSvg = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/><circle cx="11" cy="17" r="2" fill="white"/></svg>';

function realReel(item: SkanareReel): boolean {
  return Boolean(
    /^\/assets\/social-proof\/[\w./-]+\.(mp4|webm)$/i.test(item.src) &&
    /^\/assets\/social-proof\/[\w./-]+\.(webp|jpg|jpeg|png)$/i.test(item.poster) &&
    /^https:\/\/(www\.)?instagram\.com\/reel\/[\w-]+\/?(\?.*)?$/i.test(item.instagramUrl) &&
    item.label.en.trim() && item.label.el.trim()
  );
}

function createPreviewReel(index: number): HTMLElement {
  const tile = node("article", "story-reel story-reel--preview");
  const visual = node("div", "story-reel__preview-visual story-reel__preview-visual--" + ((index % 4) + 1));
  visual.append(node("span", "story-reel__preview-monogram", "S"));
  const caption = node("div", "story-reel__preview-caption");
  caption.append(
    node("span", "story-reel__preview-badge", tx("demo", "DEVELOPMENT PREVIEW")),
    node("strong", "", tx("videoSlot", "Video placeholder") + " " + (index + 1)),
    node("small", "", tx("addReel", "Add your Skanare Reel to publish"))
  );
  tile.append(visual, caption);
  return tile;
}

function initReels(): void {
  const gallery = document.getElementById("skanareReels");
  if (!gallery) return;
  const configured = homepageReels.filter(realReel);
  if (!configured.length && !previewOnly) {
    gallery.hidden = true;
    return;
  }
  const videoElements: HTMLVideoElement[] = [];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const mayAutoplay = () => !reducedMotion.matches && !saveData && !document.hidden;
  const videos = configured.length ? configured : homepageReels;
  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25 && mayAutoplay()) {
            if (video.dataset.src) {
              video.src = video.dataset.src;
              delete video.dataset.src;
              video.load();
            }
            void video.play().catch(() => { /* Browsers can still block autoplay. */ });
          } else {
            video.pause();
          }
        }
      }, { threshold: [0, 0.25, 0.6], rootMargin: "0px 0px 48px 0px" })
    : null;

  videos.forEach((reel, i) => {
    if (!realReel(reel)) {
      if (previewOnly) gallery.append(createPreviewReel(i));
      return;
    }
    const link = node("a", "story-reel");
    link.href = reel.instagramUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", reel.label[locale]);
    const video = node("video", "story-reel__video");
    video.poster = reel.poster;
    video.dataset.src = reel.src;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    const layer = node("span", "story-reel__hover");
    layer.innerHTML = instagramSvg;
    link.append(video, layer);
    gallery.append(link);
    videoElements.push(video);
    observer?.observe(video);
  });
  // Conservative fallback: do not force-load media on browsers without IO.
  const onVisibility = () => {
    if (!mayAutoplay()) videoElements.forEach((video) => video.pause());
    else if (!observer) videoElements.forEach((video) => video.pause());
  };
  reducedMotion.addEventListener("change", onVisibility);
  document.addEventListener("visibilitychange", onVisibility);
  const onPageHide = (event: PageTransitionEvent) => {
    observer?.disconnect();
    videoElements.forEach((video) => video.pause());
    if (!event.persisted) {
      reducedMotion.removeEventListener("change", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    }
  };
  const onPageShow = () => videoElements.forEach((video) => observer?.observe(video));
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
}

function validReview(raw: PublicReview): boolean {
  return raw && typeof raw.name === "string" && raw.name.trim().length > 0
    && typeof raw.comment === "string" && raw.comment.trim().length > 0
    && Number.isInteger(raw.rating) && raw.rating >= 1 && raw.rating <= 5
    && raw.verifiedPurchase === true;
}

function demoReviews(): PublicReview[] {
  const ratings = [5, 4, 3, 5, 2, 4];
  return ratings.map((rating, index) => ({
    id: "preview-" + index,
    name: tx("sampleName", "Preview card") + " " + (index + 1),
    rating,
    comment: tx("sampleText", "Example card layout — this is NOT a real customer review."),
    verifiedPurchase: false,
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    productTitle: tx("demoProduct", "Product preview"),
    featured: index === 2,
  }));
}

export function sortHomepageReviews(reviews: PublicReview[], order: Order): PublicReview[] {
  const date = (review: PublicReview) => {
    const timestamp = Date.parse(review.createdAt || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  return [...reviews].sort((a, b) => {
    if (order === "highest" && a.rating !== b.rating) return b.rating - a.rating;
    if (order === "lowest" && a.rating !== b.rating) return a.rating - b.rating;
    if (order === "featured" && Boolean(a.featured) !== Boolean(b.featured))
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    return date(b) - date(a);
  });
}

function stars(count: number): HTMLElement {
  const wrapper = node("span", "customer-reviews__stars");
  wrapper.setAttribute("aria-label", tx("ratingOf", "Rating") + ": " + count + "/5");
  wrapper.textContent = "★".repeat(Math.round(count)) + "☆".repeat(5 - Math.round(count));
  return wrapper;
}

function imageSrc(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function reviewCard(review: PublicReview, demo: boolean): HTMLElement {
  const article = node("article", "customer-review-card");
  article.setAttribute("data-no-i18n", "");
  const name = node("strong", "customer-review-card__name", review.name);
  const row = node("div", "customer-review-card__top");
  row.append(name);
  if (review.createdAt) {
    const timestamp = Date.parse(review.createdAt);
    if (Number.isFinite(timestamp)) {
      const date = node("time", "customer-review-card__date", new Intl.DateTimeFormat(
        locale === "el" ? "el-GR" : "en-GB", { year: "numeric", month: "short", day: "numeric" }
      ).format(timestamp));
      date.dateTime = review.createdAt;
      row.append(date);
    }
  }
  article.append(row, stars(review.rating), node("p", "customer-review-card__body", review.comment));
  if (review.verifiedPurchase && !demo)
    article.append(node("span", "customer-review-card__verified", "✓ " + tx("verified", "Verified purchase")));
  if (review.productTitle) {
    const product = node("div", "customer-review-card__product");
    const thumb = imageSrc(review.productImage);
    if (thumb) {
      const img = document.createElement("img");
      img.src = thumb;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      product.append(img);
    }
    if (review.productSlug && !demo) {
      const a = node("a", "", review.productTitle);
      a.href = productPath(review.productSlug);
      product.append(a);
    } else product.append(node("span", "", review.productTitle));
    article.append(product);
  }
  if (demo) article.append(node("span", "customer-review-card__demo", tx("notReal", "DEMO — NOT A CUSTOMER REVIEW")));
  return article;
}

function initReviews(): void {
  const root = document.getElementById("skanareReviews");
  if (!root) return;
  root.setAttribute("aria-busy", "true");

  const load = async () => {
    let reviews: PublicReview[] = [];
    let hasError = false;
    try {
      const response = await apiRequest<{ reviews?: PublicReview[] }>("/reviews/homepage?locale=" + locale);
      reviews = (Array.isArray(response.reviews) ? response.reviews : []).filter(validReview);
    } catch {
      hasError = true;
    }

    const demo = previewOnly && reviews.length === 0;
    if (demo) reviews = demoReviews();
    root.replaceChildren();
    root.removeAttribute("aria-busy");

    if (!reviews.length) {
      root.append(node("p", "customer-reviews__empty", hasError
        ? tx("unavailable", "Customer reviews are temporarily unavailable.")
        : tx("empty", "Verified customer reviews will appear here as they arrive.")));
      return;
    }

    let sortOrder: Order = "featured";
    let count = 4;
    const header = node("div", "customer-reviews__controls");
    const summaryWrap = node("div", "customer-reviews__summary-wrap");
    const summaryButton = node("button", "customer-reviews__summary-button");
    summaryButton.type = "button";
    summaryButton.setAttribute("aria-expanded", "false");
    summaryButton.setAttribute("aria-label", tx("distribution", "Show rating distribution"));
    const sum = reviews.reduce((total, review) => total + review.rating, 0);
    const average = sum / reviews.length;
    const summaryText = node("span", "customer-reviews__summary-text",
      average.toFixed(1) + " · " + reviews.length + " " + tx("reviews", "reviews") + " ▾");
    summaryButton.append(stars(average), summaryText);

    const distribution = node("div", "customer-reviews__distribution");
    distribution.hidden = true;
    distribution.id = "skanareReviewDistribution";
    summaryButton.setAttribute("aria-controls", distribution.id);
    const score = node("div", "customer-reviews__score");
    score.append(stars(average), node("strong", "", average.toFixed(1)));
    distribution.append(score);
    for (let rating = 5; rating >= 1; rating--) {
      const matches = reviews.filter((review) => review.rating === rating).length;
      const line = node("div", "customer-reviews__distribution-row");
      const label = node("span", "", rating + " ★");
      const progress = node("div", "customer-reviews__progress");
      progress.setAttribute("role", "meter");
      progress.setAttribute("aria-label", rating + " " + tx("stars", "stars"));
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", String(reviews.length));
      progress.setAttribute("aria-valuenow", String(matches));
      const fill = node("span", "customer-reviews__progress-fill");
      fill.style.width = (matches / reviews.length * 100).toFixed(2) + "%";
      progress.append(fill);
      line.append(label, progress, node("span", "", String(matches)));
      distribution.append(line);
    }
    summaryWrap.append(summaryButton, distribution);

    const menuWrap = node("div", "customer-reviews__menu-wrap");
    const filterButton = node("button", "customer-reviews__filter");
    filterButton.type = "button";
    filterButton.setAttribute("aria-label", tx("sort", "Sort reviews"));
    filterButton.setAttribute("aria-expanded", "false");
    filterButton.setAttribute("aria-controls", "skanareReviewSort");
    filterButton.innerHTML = filterSvg;
    const menu = node("div", "customer-reviews__menu");
    menu.id = "skanareReviewSort";
    menu.setAttribute("role", "group");
    menu.setAttribute("aria-label", tx("sort", "Sort reviews"));
    menu.hidden = true;
    const grid = node("div", "customer-reviews__grid");
    const more = node("button", "customer-reviews__more", tx("more", "Show more reviews"));
    more.type = "button";

    const labels: { id: Order; text: string }[] = [
      { id: "featured", text: tx("featured", "Featured") },
      { id: "newest", text: tx("newest", "Newest") },
      { id: "highest", text: tx("highest", "Highest Ratings") },
      { id: "lowest", text: tx("lowest", "Lowest Ratings") },
    ];
    const render = () => {
      grid.replaceChildren(...sortHomepageReviews(reviews, sortOrder)
        .slice(0, count).map((review) => reviewCard(review, demo)));
      more.hidden = count >= reviews.length;
      menu.querySelectorAll<HTMLButtonElement>("button[data-sort]").forEach((button) => {
        const active = button.dataset.sort === sortOrder;
        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("is-selected", active);
      });
    };
    const setOpen = (element: HTMLElement, button: HTMLButtonElement, open: boolean) => {
      element.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    };
    labels.forEach((item) => {
      const button = node("button", "customer-reviews__menu-option", item.text);
      button.type = "button";
      button.dataset.sort = item.id;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        sortOrder = item.id;
        count = 4;
        setOpen(menu, filterButton, false);
        render();
        filterButton.focus();
      });
      menu.append(button);
    });
    summaryButton.addEventListener("click", () => {
      const open = distribution.hidden;
      setOpen(distribution, summaryButton, open);
      setOpen(menu, filterButton, false);
    });
    filterButton.addEventListener("click", () => {
      const open = menu.hidden;
      setOpen(menu, filterButton, open);
      setOpen(distribution, summaryButton, false);
      if (open) menu.querySelector<HTMLButtonElement>("button")?.focus();
    });
    more.addEventListener("click", () => {
      count += 4;
      render();
    });
    const closeMenus = () => {
      setOpen(menu, filterButton, false);
      setOpen(distribution, summaryButton, false);
    };
    const onOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!summaryWrap.contains(event.target) && !menuWrap.contains(event.target)) closeMenus();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (!menu.hidden || !distribution.hidden)) {
        closeMenus();
        filterButton.focus();
      }
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("pagehide", () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    }, { once: true });

    menuWrap.append(filterButton, menu);
    header.append(summaryWrap, menuWrap);
    if (demo) root.append(node("p", "customer-reviews__demo-banner",
      tx("demoNotice", "DEVELOPMENT PREVIEW · All reviews below are fictional layout placeholders, not customer feedback.")));
    root.append(header, grid, more);
    render();
  };

  // Defer the additional API query until the reviews are near the viewport.
  if (!("IntersectionObserver" in window)) {
    void load();
    return;
  }
  const loadObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    loadObserver.disconnect();
    void load();
  }, { rootMargin: "320px 0px" });
  loadObserver.observe(root);
  window.addEventListener("pagehide", () => loadObserver.disconnect(), { once: true });
}

export function initHomepageSocialProof(): void {
  const storyTitle = document.getElementById("skanareStoryTitle");
  const storyLead = document.getElementById("skanareStoryLead");
  const reviewsTitle = document.getElementById("skanareReviewsTitle");
  if (!storyTitle || !storyLead || !reviewsTitle) return;
  storyTitle.textContent = tx("storyTitle", "Who Are We?");
  storyLead.textContent = tx("storyLead",
    "Skanare brings clean design and dynamic QR technology together. Our clothing and accessories connect what you hold or wear with the digital experiences you choose — and selected QR destinations can change with you.");
  reviewsTitle.textContent = tx("reviewsTitle", "Customer Reviews");
  const storyEyebrow = document.getElementById("skanareStoryEyebrow");
  if (storyEyebrow) storyEyebrow.textContent = tx("storyEyebrow", "BEYOND THE PRODUCT");
  initReels();
  initReviews();
}
