// js/2fa-verify.js
import { authStore } from "./authStore.js";

/* ───────────────────────────────
   AUTH LOGIC ONLY — NO LOADER HERE
──────────────────────────────── */

const email = sessionStorage.getItem("auth_email");

if (!email) {
  window.location.replace("admin-login.html");
}

const form = document.getElementById("otpForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const otp = form.otp.value.trim();
  if (!otp) return;

  const res = await fetch("/api/auth/2fa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, otp })
  });

  const payload = await res.json(); // ✅ READ ONCE

  // 🧠 Backend short-circuit: already authenticated
  if (payload.already_authenticated) {
    window.location.replace("dashboard-admin.html");
    return;
  }

  if (!res.ok) {
    alert("Invalid OTP");
    return;
  }

  const { access_token } = payload; // ✅ REUSE PARSED DATA

  // Memory-only token (correct)
  authStore.set(access_token);

  sessionStorage.removeItem("auth_email");

  // 🚀 Dashboard takes over loader from here
  window.location.replace("dashboard-admin.html");
});
