/**
 * Native-feeling cart dismissal on touch screens.
 * Rightward horizontal drags close the right-side drawer. Vertical scrolling,
 * form controls and horizontal product carousels retain their normal gestures.
 */
export function shouldDismissCartSwipe(dx: number, dy: number, drawerWidth: number, elapsedMs: number): boolean {
  if (dx <= 0 || Math.abs(dx) < Math.abs(dy) * 1.3) return false;
  const enoughDistance = dx >= Math.max(86, drawerWidth * 0.28);
  const quickFlick = dx >= 48 && elapsedMs > 0 && dx / elapsedMs >= 0.58;
  return enoughDistance || quickFlick;
}

type SwipeStart = { x: number; y: number; at: number };

export function installMobileCartSwipe(
  drawer: HTMLElement,
  overlay: HTMLElement,
  dismiss: () => void
): () => void {
  const mobile = window.matchMedia("(max-width: 760px)");
  let start: SwipeStart | null = null;
  let dragging = false;
  let snapbackTimer: number | null = null;

  const clearSnapback = () => {
    if (snapbackTimer !== null) {
      window.clearTimeout(snapbackTimer);
      snapbackTimer = null;
    }
  };

  const resetVisuals = () => {
    clearSnapback();
    drawer.classList.remove("cart-swipe-dragging");
    drawer.style.removeProperty("transition");
    drawer.style.removeProperty("transform");
    overlay.style.removeProperty("transition");
    overlay.style.removeProperty("opacity");
  };

  const snapBack = () => {
    if (!dragging) return;
    dragging = false;
    drawer.classList.remove("cart-swipe-dragging");
    drawer.style.transition = "transform 200ms ease-out";
    drawer.style.transform = "translate3d(0, 0, 0)";
    overlay.style.transition = "opacity 200ms ease-out";
    overlay.style.opacity = "1";
    clearSnapback();
    snapbackTimer = window.setTimeout(() => {
      // Do not override a new swipe in progress.
      if (!dragging) resetVisuals();
    }, 210);
  };

  drawer.addEventListener("touchstart", event => {
    if (!mobile.matches || !drawer.classList.contains("open") ||
        event.touches.length !== 1 || document.body.classList.contains("gift-dialog-open")) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest(
      "button, input, select, textarea, [contenteditable], " +
      ".cart-cross-sell, .cart-cross-sell-row, [data-no-cart-swipe], .cart-gift-dialog"
    )) return;

    clearSnapback();
    resetVisuals();
    start = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      at: performance.now(),
    };
    dragging = false;
  }, { passive: true });

  drawer.addEventListener("touchmove", event => {
    if (!start || !mobile.matches) return;
    if (event.touches.length !== 1) {
      start = null;
      snapBack();
      return;
    }

    const dx = event.touches[0].clientX - start.x;
    const dy = event.touches[0].clientY - start.y;
    if (!dragging) {
      // Wait for a clear rightward gesture; never steal vertical cart scroll.
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        start = null;
        return;
      }
      if (dx < 12 || dx < Math.abs(dy) * 1.35) return;
      dragging = true;
      drawer.classList.add("cart-swipe-dragging");
    }

    if (event.cancelable) event.preventDefault();
    const width = Math.max(1, drawer.getBoundingClientRect().width);
    const distance = Math.min(width, Math.max(0, dx));
    drawer.style.transition = "none";
    drawer.style.transform = `translate3d(${distance}px, 0, 0)`;
    overlay.style.transition = "none";
    overlay.style.opacity = String(Math.max(0, 1 - distance / width));
  }, { passive: false });

  drawer.addEventListener("touchend", event => {
    if (!start) return;
    const startPoint = start;
    start = null;
    if (!dragging || !event.changedTouches.length) {
      snapBack();
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - startPoint.x;
    const dy = touch.clientY - startPoint.y;
    const elapsed = performance.now() - startPoint.at;

    if (shouldDismissCartSwipe(dx, dy, drawer.getBoundingClientRect().width, elapsed)) {
      dragging = false;
      drawer.classList.remove("cart-swipe-dragging");
      drawer.style.transition = "transform 210ms ease-out";
      drawer.style.transform = "translateX(100%)";
      overlay.style.transition = "opacity 210ms ease-out";
      overlay.style.opacity = "0";
      dismiss();
    } else {
      snapBack();
    }
  }, { passive: true });

  drawer.addEventListener("touchcancel", () => {
    start = null;
    snapBack();
  }, { passive: true });

  // Called on open and after close to clear any interrupted gestures.
  return () => {
    start = null;
    dragging = false;
    resetVisuals();
  };
}
