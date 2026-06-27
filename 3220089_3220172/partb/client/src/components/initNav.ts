/* 3220089_3220172 2025 */

import { signOut } from "firebase/auth";
import { firebaseAuth } from "../services/firebase";
import { removeToken } from "../services/auth";

import { transferCartToGuest } from "../services/cart";

export function initNav() {
  const btn = document.querySelector(".account-btn") as HTMLElement | null;
  const dropdown = document.querySelector(
    ".account-dropdown"
  ) as HTMLElement | null;

  if (!btn || !dropdown) return;

  // Καθαρίζουμε τυχόν παλιό περιεχόμενο
  dropdown.innerHTML = "";

  firebaseAuth.onAuthStateChanged((user) => {
    // Reset UI
    dropdown.classList.add("hidden");
    btn.classList.remove("active");

    // Αφαιρούμε τυχόν παλιό content
    dropdown.innerHTML = "";

    // ==========================
    // NOT LOGGED IN
    // ==========================
    if (!user) {
      btn.onclick = () => {
        window.location.href = "/src/pages/login/login.html";
      };

      return;
    }

    // ==========================
    // LOGGED IN
    // ==========================
    btn.onclick = (e) => {
      e.stopPropagation();

      dropdown.classList.toggle("hidden");
      btn.classList.toggle("active");
    };

    dropdown.innerHTML = `
      <button id="logoutBtn" type="button">
        Sign out
      </button>
    `;

    const logoutBtn = document.getElementById("logoutBtn");

    logoutBtn?.addEventListener("click", async (e) => {
  e.stopPropagation();

  try {
    await transferCartToGuest();

    await signOut(firebaseAuth);

    removeToken();

    window.location.href = "/index.html";
  } catch (err) {
    console.error("Logout failed:", err);
  }
});

    // Hover open
    btn.addEventListener("mouseenter", () => {
      dropdown.classList.remove("hidden");
      btn.classList.add("active");
    });

    // Hover close
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
  });

  // Click outside closes menu
  document.addEventListener("click", () => {
    dropdown.classList.add("hidden");
    btn.classList.remove("active");
  });
}
