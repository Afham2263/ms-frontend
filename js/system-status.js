// js/system-status.js
// ─────────────────────────────────────────────
// SYSTEM STATUS FETCHER (WHATSAPP KILL SWITCH)
// Backend is the ONLY source of truth.
// Compatible with:
// - mock-api.js (ngrok proxy)
// - HttpOnly cookie auth
// - local dev / prod
// ─────────────────────────────────────────────

let cache = null;
let lastFetch = 0;

// Soft TTL only — backend remains authoritative
const TTL_MS = 30_000; // 30 seconds

export async function fetchSystemStatus({ force = false } = {}) {
  const now = Date.now();

  // Soft cache (dashboard refresh friendliness)
  if (!force && cache && now - lastFetch < TTL_MS) {
    return cache;
  }

  let res;
  try {
    res = await fetch("/api/system/status", {
      method: "GET",
      credentials: "include", // 🔥 REQUIRED for consistency
      headers: {
        "Accept": "application/json"
      }
    });
  } catch (err) {
    console.error("[SYSTEM STATUS] Network error", err);
    throw new Error("System status unavailable");
  }

  if (!res.ok) {
    console.error(
      "[SYSTEM STATUS] Backend error",
      res.status,
      res.statusText
    );
    throw new Error("System status unavailable");
  }

  const data = await res.json();

  // 🔒 Hard validation (fail loud if backend contract breaks)
  if (
    typeof data !== "object" ||
    typeof data.whatsapp_send_enabled !== "boolean"
  ) {
    console.error("[SYSTEM STATUS] Invalid payload", data);
    throw new Error("System status unavailable");
  }

  cache = data;
  lastFetch = now;

  return data;
}

// Optional helper (useful later)
export function clearSystemStatusCache() {
  cache = null;
  lastFetch = 0;
}
