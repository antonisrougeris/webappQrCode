/* 3220089_3220172  2025 */

import { createUserWithEmailAndPassword } from "firebase/auth";
import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import { readData, validateAndShowErrors } from "../../utils/register-validation";
import { firebaseAuth } from "../../services/firebase";
import { saveToken } from "../../services/auth";
import { register } from "../../services/api";

// Initialize navigation (handles login/logout state)
initNav();
updateCartBadge();
initMobileMenu();

const form = document.getElementById("registerForm") as HTMLFormElement;
const statusEl = document.getElementById("status");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (statusEl) statusEl.textContent = "";

  const data = readData(form);
  const ok = validateAndShowErrors(form, data);
  if (!ok) {
    if (statusEl) statusEl.textContent = "Please fix the highlighted errors.";
    return;
  }

  if (statusEl) statusEl.textContent = "Registering...";

  const payload = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    password: data.password,
    birthdate: data.birthdate,
    gender: data.gender,
    interests: data.interests,
    experience: data.experience,
    goals: data.goals,
    newsletter: data.newsletter,
  };

  try {
    const credentials = await createUserWithEmailAndPassword(firebaseAuth, payload.email, payload.password);
    const token = await credentials.user.getIdToken();
    saveToken(token);

    const data = await register({
      ...payload,
      idToken: token,
    });

    if (data?.token) {
      saveToken(data.token);
    }
    statusEl!.textContent = "Registration successful! Redirecting...";
    setTimeout(() => {
      window.location.href = "/index.html";
    }, 1500);
  } catch (err: any) {
    console.error("Register error:", err);
    statusEl!.textContent = err.message || "Registration failed";
  }
});
