// js/auth.js
import { authStore } from "./authStore.js";
import { bootstrapAuth } from "./auth-bootstrap.js";

const form = document.getElementById("loginForm");
const previewBtn = document.getElementById("previewBtn");

/* ───────────────────────────────
   PREVIEW MODE REMOVED (UI STAYS)
──────────────────────────────── */
if (previewBtn) {
  previewBtn.addEventListener("click", () => {
    alert("Preview mode has been removed. Please login normally.");
  });
}

// 🔐 LOGIN PAGE GUARD
(async function guardLoginPage() {
  const ok = await bootstrapAuth();
  if (ok) {
    window.location.replace("dashboard-admin.html");
  }
})();

/* ───────────────────────────────
   AUTH LOADER (DOM-ONLY, SAFE)
──────────────────────────────── */
function showLoader(text = "Loading…") {
  const el = document.getElementById("authLoading");
  if (!el) return;

  const txt = el.querySelector("#authLoadingText");
  if (txt) txt.textContent = text;

  el.hidden = false;

  // force paint
  document.body.offsetHeight;
}

function hideLoader() {
  const el = document.getElementById("authLoading");
  if (el) el.hidden = true;
}

/* ───────────────────────────────
   ACCOUNT LOCKOUT HANDLER (UNCHANGED)
──────────────────────────────── */
function handleAccountLockout(retryAfterSeconds) {
  const inputs = form.querySelectorAll("input");
  const submitBtn = form.querySelector("button[type=submit]");

  inputs.forEach(i => (i.disabled = true));
  submitBtn.disabled = true;

  let msg = document.getElementById("lockoutMsg");
  if (!msg) {
    msg = document.createElement("p");
    msg.id = "lockoutMsg";
    msg.className = "lockout-msg";
    form.appendChild(msg);
  }

  let remaining = retryAfterSeconds;

  const tick = () => {
    const minutes = Math.ceil(remaining / 60);
    msg.textContent =
      `Too many failed attempts. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`;

    if (remaining <= 0) {
      clearInterval(timer);
      msg.remove();
      inputs.forEach(i => (i.disabled = false));
      submitBtn.disabled = false;
      return;
    }
    remaining--;
  };

  tick();
  const timer = setInterval(tick, 1000);
}

/* ───────────────────────────────
   LOGIN HANDLER
──────────────────────────────── */
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const email = data.get("email")?.trim();
    const password = data.get("password")?.trim();
    if (!email || !password) return;

    showLoader("Verifying credentials…");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      if (res.status === 429) {
        hideLoader();
        const payload = await res.json();
        if (payload?.error === "ACCOUNT_LOCKED") {
          handleAccountLockout(payload.retry_after_seconds);
          return;
        }
      }

      if (!res.ok) {
        hideLoader();
        alert("Invalid credentials");
        return;
      }

      const payload = await res.json();

      // 🧠 Backend short-circuit: already logged in (multi-tab / refresh case)
      if (payload.already_authenticated) {
        window.location.replace("dashboard-admin.html");
        return;
      }


      if (payload.requires_2fa_setup) {
        sessionStorage.setItem("auth_email", email);
        window.location.href = "2fa-setup.html";
        return;
      }

      if (payload.requires_2fa) {
        sessionStorage.setItem("auth_email", email);
        showLoader("Preparing security verification…");
        window.location.href = "2fa-verify.html";
        return;
      }

      hideLoader();

    } catch (err) {
      hideLoader();
      console.error(err);
      alert("Network error");
    }
  });
}
