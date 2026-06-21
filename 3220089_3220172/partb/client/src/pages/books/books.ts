/* 3220089_3220172  2025 */

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import { renderBooks } from "../../components/renderCards";
import { getBooks, getMyPurchases } from "../../services/api";
import { isLoggedIn } from "../../services/auth";

// Initialize navigation globally for this page
initNav();

initMobileMenu();
updateCartBadge();

// Book interface matching server data
interface Book {
  _id?: string;
  id: string;
  title: string;
  author: string;
  category: string;
  shortDescription: string;
  priceUSD: number;
  rating: number;
  image?: string;
}

/**
 * Normalizes text for case-insensitive searching.
 * @param {string} text
 * @returns {string}
 */
function normalize(text: string | number): string {
  return (text || "").toString().trim().toLowerCase();
}

/**
 * Applies filters to the book list.
 * - q: search query (matches title/author/shortDescription)
 * - category: category filter ("All" means no filter)
 *
 * @param {Array} list
 * @param {{q:string, category:string}} state
 * @returns {Array}
 */
function applyFilters(list: Book[], { q, category }: { q: string; category: string }): Book[] {
  const query = normalize(q);

  return list.filter((b) => {
    // Search: match query in title OR author OR description
    const matchesQuery =
      !query ||
      normalize(b.title).includes(query) ||
      normalize(b.author).includes(query) ||
      normalize(b.shortDescription).includes(query);

    // Category: "All" means accept all categories
    const matchesCategory = category === "All" || b.category === category;

    return matchesQuery && matchesCategory;
  });
}

/**
 * Reads current filter state from the URL query string (?q=...&category=...).
 * @returns {{q:string, category:string}}
 */
function getStateFromURL(): { q: string; category: string } {
  const params = new URLSearchParams(window.location.search);

  return {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "All",
  };
}

/**
 * Writes current filter state to the URL without reloading the page.
 * Uses replaceState to avoid polluting history while typing.
 *
 * @param {{q:string, category:string}} state
 */
function setStateToURL(state: { q: string; category: string }): void {
  const params = new URLSearchParams();

  // Keep the URL clean: only store q if it is not empty
  if (state.q && state.q.trim() !== "") {
    params.set("q", state.q.trim());
  }

  // Keep the URL clean: only store category if it isn't "All"
  if (state.category && state.category !== "All") {
    params.set("category", state.category);
  }

  const queryString = params.toString();
  const newURL = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;

  // Update URL without reloading
  window.history.replaceState(null, "", newURL);
}

/**
 * Page initializer for books.html
 * - Fetches books from server API
 * - Reads URL state (deep links / refresh)
 * - Syncs UI controls
 * - Filters and renders the books
 * - Shows/hides empty state message
 */
async function initBooksPage(): Promise<void> {
  // Main grid container where book cards will be rendered
  const grid = document.getElementById("booksGrid") as HTMLElement;
  if (!grid) return; // not on this page

  // UI controls
  const searchInput = document.getElementById("bookSearch") as HTMLInputElement | null;
  const categorySelect = document.getElementById("bookCategory") as HTMLSelectElement | null;
  const emptyEl = document.getElementById("booksEmpty") as HTMLElement | null;
  const loadingEl = document.getElementById("booksLoading") as HTMLElement | null;
  const errorEl = document.getElementById("booksError") as HTMLElement | null;

  // Load initial state from URL
  const urlState = getStateFromURL();

  // Sync controls with URL state
  if (searchInput) searchInput.value = urlState.q;
  if (categorySelect) categorySelect.value = urlState.category;

  // Store books data
  let booksData: Book[] = [];

  // If logged in, load owned books once
  let ownedBookIds: Set<string> | undefined = undefined;
  if (isLoggedIn()) {
    try {
      const purchases = await getMyPurchases();
      const list = Array.isArray(purchases) ? purchases : (purchases?.purchases ?? []);
      ownedBookIds = new Set(
        (list || [])
          .map((p: any) => (p?.bookId ?? "").toString())
          .filter((x: string) => x.length > 0)
      );
    } catch (e) {
      // Non-fatal: if purchases fail, page still works
      console.warn("Could not load purchases:", e);
    }
  }

  // Read current UI state
  const getState = () => ({
    q: searchInput ? searchInput.value : "",
    category: categorySelect ? (categorySelect.value || "All") : "All",
  });

  // Update loop: URL sync + filter + render
  const update = () => {
    const state = getState();

    // Keep URL in sync (no reload)
    setStateToURL(state);

    // Filter books and render cards
    const filtered = applyFilters(booksData, state);
    renderBooks(grid, filtered, ownedBookIds);

    // Toggle empty message visibility
    if (emptyEl) {
      emptyEl.hidden = filtered.length !== 0;
    }
  };

  // Load books from API
  try {
    if (loadingEl) loadingEl.hidden = false;
    if (errorEl) errorEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;

    console.log("Fetching books from API...");
    const response = await getBooks();
    console.log("Books API response:", response);
    
    // API returns array directly
    booksData = Array.isArray(response) ? response : (response.books || []);
    console.log("Processed books data:", booksData);

    if (loadingEl) loadingEl.hidden = true;

    // Initial render
    update();

    // Live updates on user input
    if (searchInput) searchInput.addEventListener("input", update);
    if (categorySelect) categorySelect.addEventListener("change", update);
  } catch (error) {
    console.error("Failed to load books:", error);
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = `Failed to load books: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBooksPage);
} else {
  initBooksPage();
}

