/* 3220089_3220172  2025 */

import { isLoggedIn, removeToken } from "../services/auth";

let isInitialized = false;

export function initNav() {
  if (isInitialized) return;

  const btn = document.querySelector(".account-btn") as HTMLElement | null;
  const dropdown = document.querySelector(
    ".account-dropdown"
  ) as HTMLElement | null;

  if (!btn || !dropdown) return;

  const loggedIn = isLoggedIn();

  // ✅ NOT LOGGED IN → redirect μόνο
  if (!loggedIn) {
    btn.addEventListener("click", () => {
      window.location.href = "/src/pages/login/login.html";
    });

    isInitialized = true;
    return;
  }

  // ✅ LOGGED IN → dropdown
  btn.addEventListener("click", (e) => {
    e.stopPropagation();

    dropdown.classList.toggle("hidden");
    btn.classList.toggle("active");
  });

  // ✅ Dropdown content
  dropdown.innerHTML = `
    <button id="logoutBtn">Sign out</button>
  `;

  // ✅ Logout
  const logoutBtn = document.getElementById("logoutBtn");

  logoutBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    removeToken();
    window.location.href = "/src/pages/login/login.html";
  });

  // ✅ hover open
  btn.addEventListener("mouseenter", () => {
    dropdown.classList.remove("hidden");
    btn.classList.add("active");
  });

  // ✅ hover leave (από button ή dropdown)
  btn.addEventListener("mouseleave", () => {
    setTimeout(() => {
      if (!dropdown.matches(":hover")) {
        dropdown.classList.add("hidden");
        btn.classList.remove("active");
      }
    }, 100);
  });

  dropdown.addEventListener("mouseleave", () => {
    dropdown.classList.add("hidden");
    btn.classList.remove("active");
  });

  // ✅ Close όταν πατάς έξω
  document.addEventListener("click", () => {
    dropdown.classList.add("hidden");
    btn.classList.remove("active");
  });

  isInitialized = true;
}
