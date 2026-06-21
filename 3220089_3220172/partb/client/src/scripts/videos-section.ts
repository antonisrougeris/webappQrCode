/* 3220089_3220172   2025 */

import { videos, getVideoById } from "./videos-data";

/**
 * Initializes the "Intro Video" section.
 * This section is data-driven: it reads from videos-data and renders UI.
 *
 * Expected HTML:
 * <section id="videosSection"></section>
 *
 * The "Watch video" link uses data attributes so modal can open the video
 * via event delegation:
 *   data-modal="video"
 *   data-src="..."
 *   data-title="..."
 * 
 * @param videoId - Optional video ID to display. If not provided, displays the first video.
 */
export function initVideosSection(videoId?: string) {
  // This container can exist on about.html OR index.html
  const container = document.getElementById("videosSection");
  if (!container) return; // not on this page

  // Get video by ID if provided, otherwise use the first video
  const intro = videoId ? getVideoById(videoId) : videos[0];
  if (!intro) return;

  // Render section markup
  container.innerHTML = `
    <h2 class="section-title">Intro Video</h2>

    <article class="card" style="display:grid; gap:0.75rem;">
      <h3 style="margin:0;">${intro.title}</h3>

      <p class="meta" style="margin:0;">
        ${intro.duration ? `Duration: ${intro.duration}` : ""}
      </p>

      <p style="margin:0;">${intro.description}</p>

      <a
        href="#"
        class="btn-outline"
        data-modal="video"
        data-src="${intro.src}"
        data-title="${intro.title}"
      >
        Watch video
      </a>
    </article>
  `;
}
