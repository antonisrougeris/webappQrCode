/* 3220089_3220172  2025 */

import { isLoggedIn, removeToken } from "../services/auth";

// Track if nav has already been initialized
let isInitialized = false;

export function initNav() {
  // Prevent multiple initializations
  if (isInitialized) return;
  
  const nav = document.querySelector("nav");
  if (!nav) return;

  const loginLink = nav.querySelector("a[href*='login']");
  const registerLink = nav.querySelector("a[href*='register']");

  if (isLoggedIn()) {
    // Only modify nav if user is logged in
    const existingLogout = nav.querySelector("a[href='#']:not([href*='login']):not([href*='register'])");
    
    // Don't add logout button if it already exists
    if (existingLogout) {
      isInitialized = true;
      return;
    }

    const logoutLink = document.createElement("a");
    logoutLink.textContent = "Logout";
    logoutLink.href = "#";
    logoutLink.classList.add("btn-outline");

    loginLink?.remove();
    registerLink?.remove();
    nav.appendChild(logoutLink);

    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      removeToken();
      window.location.href = "/src/pages/login/login.html";
    });
  }

  // Mark as initialized
  isInitialized = true;
}
