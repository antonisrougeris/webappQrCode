/**
 * Homepage reels: add ONLY media owned/licensed by Skanare.
 * Put optimized MP4/WebM and poster images inside public/assets/social-proof/.
 * Source and Instagram Reel URL must both be real before an item goes public.
 * Empty values are deliberately ignored in production.
 */
export interface SkanareReel {
  id: string;
  src: string;
  poster: string;
  instagramUrl: string;
  label: { en: string; el: string };
}

export const homepageReels: SkanareReel[] = [
  { id: "reel-01", src: "", poster: "", instagramUrl: "", label: { en: "", el: "" } },
  { id: "reel-02", src: "", poster: "", instagramUrl: "", label: { en: "", el: "" } },
  { id: "reel-03", src: "", poster: "", instagramUrl: "", label: { en: "", el: "" } },
  { id: "reel-04", src: "", poster: "", instagramUrl: "", label: { en: "", el: "" } },
];
