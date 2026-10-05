import { firebaseAuth } from "@/lib/firebase";

export function isLoggedIn(): boolean {
  return Boolean(firebaseAuth.currentUser);
}

export async function waitForAuthReady(): Promise<void> {
  await firebaseAuth.authStateReady();
}
