/*  3220089_3220172   2025 */
/**
 * Static dataset for intro / promo videos.
 * Used by videos-section.ts.
 */
export const videos = [
  {
    id: "why-devdromos",
    title: "Why DevDromos?",
    description: "A short introduction to the platform and how it helps you learn.",
    src: "/assets/img/Why_DevDromos.mp4", // keep your current location
    poster: "/assets/img/logo_Image.png", // optional (can be any image)
    duration: "1:10", // optional
  },
];

/**
 * Returns a video by id.
 * @param {string} id
 * @returns {Object|null}
 */
export function getVideoById(id: string) {
  return videos.find((v) => v.id === id) || null;
}
