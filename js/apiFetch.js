import { authStore } from "./authStore.js";

export async function apiFetch(url, options = {}, retry = true) {
  const headers = {
    ...(options.headers || {}),
    ...(authStore.get()
      ? { Authorization: `Bearer ${authStore.get()}` }
      : {})
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status !== 401) return res;

  // Prevent infinite loops
  if (!retry) {
    authStore.clear();
    window.location.href = "admin-login.html";
    throw new Error("Unauthorized");
  }

  // Silent refresh (cookie-based)
  const refresh = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include"
  });

  if (!refresh.ok) {
    authStore.clear();
    window.location.href = "admin-login.html";
    throw new Error("Session expired");
  }

  const { access_token } = await refresh.json();
  authStore.set(access_token);

  return apiFetch(url, options, false);
}
