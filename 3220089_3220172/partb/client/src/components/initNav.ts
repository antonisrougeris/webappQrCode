/* 3220089_3220172 2025 */

import { signOut } from "firebase/auth";
import { firebaseAuth } from "../services/firebase";
import { removeToken } from "../services/auth";
import { transferCartToGuest } from "../services/cart";

export function initNav() {
  const btnElement =
    document.querySelector<HTMLButtonElement>(".account-btn");

  const dropdownElement =
    document.querySelector<HTMLElement>(".account-dropdown");

  const accountMenuElement =
    document.querySelector<HTMLElement>(".account-menu");

  if (!btnElement || !dropdownElement || !accountMenuElement) {
    return;
  }

  // Από εδώ και κάτω το TypeScript ξέρει ότι δεν είναι null.
  const btn = btnElement;
  const dropdown = dropdownElement;
  const accountMenu = accountMenuElement;

  if (btn.dataset.accountMenuInitialized === "true") return;
  btn.dataset.accountMenuInitialized = "true";

  let isLoggedIn = false;
  let hoverCloseTimer: number | null = null;

  const supportsRealHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  function openDropdown() {
    if (!isLoggedIn) return;

    dropdown.classList.remove("hidden");
    btn.classList.add("active");
    btn.setAttribute("aria-expanded", "true");
  }

  function closeDropdown() {
    dropdown.classList.add("hidden");
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
  }

  function toggleDropdown() {
    if (dropdown.classList.contains("hidden")) {
      openDropdown();
    } else {
      closeDropdown();
    }
  }

  btn.setAttribute("aria-expanded", "false");

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isLoggedIn) {
      window.location.href = "/src/pages/login/login.html";
      return;
    }

    toggleDropdown();
  });

  if (supportsRealHover) {
    accountMenu.addEventListener("mouseenter", () => {
      if (hoverCloseTimer !== null) {
        window.clearTimeout(hoverCloseTimer);
        hoverCloseTimer = null;
      }

      openDropdown();
    });

    accountMenu.addEventListener("mouseleave", () => {
      hoverCloseTimer = window.setTimeout(() => {
        closeDropdown();
      }, 120);
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target as Node;

    if (!accountMenu.contains(target)) {
      closeDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDropdown();
      btn.focus();
    }
  });

  firebaseAuth.onAuthStateChanged((user) => {
    isLoggedIn = Boolean(user);

    closeDropdown();
    dropdown.innerHTML = "";

    if (!user) return;

    dropdown.innerHTML = `
      <button id="logoutBtn" type="button">
        Sign out
      </button>
    `;

    const logoutBtn =
      dropdown.querySelector<HTMLButtonElement>("#logoutBtn");

    logoutBtn?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      logoutBtn.disabled = true;
      logoutBtn.textContent = "Signing out...";

      try {
        await transferCartToGuest();
        await signOut(firebaseAuth);
        removeToken();

        window.location.href = "/index.html";
      } catch (error) {
        console.error("Logout failed:", error);

        logoutBtn.disabled = false;
        logoutBtn.textContent = "Sign out";
      }
    });
  });
}