// js/auth-bootstrap.js
import { authStore } from "./authStore.js";

export async function bootstrapAuth() {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include"
    });

    // 🔐 AUTHENTICATED
    if (res.ok) {
      const { access_token, user } = await res.json();
      authStore.set(access_token, user);
      return true;
    }


    // ❌ UNAUTHENTICATED (401 OR 429)
    authStore.clear();
    return false;

  } catch (err) {
    console.error("Auth bootstrap failed", err);
    authStore.clear();
    return false;
  }
}
