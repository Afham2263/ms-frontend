// js/2fa-setup.js
import { authStore } from "./authStore.js";

const email = sessionStorage.getItem("auth_email");
const password = sessionStorage.getItem("auth_password");

if (!email || !password) {
  window.location.replace("admin-login.html");
}

const qrBox = document.getElementById("qrBox");
const form = document.getElementById("otpForm");

// STEP 1: Request QR code
(async function setup2FA() {
  const res = await fetch("/api/auth/2fa/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    alert("Failed to initialize 2FA setup");
    window.location.replace("admin-login.html");
    return;
  }

  const { otpauth_url } = await res.json();

  // Simple QR render via Google Charts (no lib)
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(otpauth_url);

  qrBox.innerHTML = `<img src="${qrUrl}" alt="2FA QR Code"/>`;
})();

// STEP 2: Confirm OTP
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const otp = form.otp.value.trim();
  if (!otp) return;

  const res = await fetch("/api/auth/2fa/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // 🔥 REQUIRED
    body: JSON.stringify({ email, otp })
  });

  if (!res.ok) {
    alert("Invalid OTP");
    return;
  }

  const { access_token } = await res.json();

  // ✅ STORE TOKEN IN MEMORY ONLY
  authStore.set(access_token);

  // Cleanup
  sessionStorage.removeItem("auth_email");
  sessionStorage.removeItem("auth_password");

  // Enter admin
  window.location.replace("dashboard-admin.html");
});
