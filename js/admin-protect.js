import { authStore } from "./authStore.js";
import { bootstrapAuth } from "./auth-bootstrap.js";

function renderCurrentUser() {
  const user = authStore.getUser();
  if (!user) return;

  const emailEl = document.getElementById("userEmail");
  const roleEl = document.getElementById("userRole");
  const avatarEl = document.getElementById("userAvatar");

  if (emailEl) emailEl.textContent = user.email;
  if (roleEl) roleEl.textContent = user.role;
  if (avatarEl) avatarEl.textContent = user.email[0].toUpperCase();
}


/* ───────────────────────────────
   DASHBOARD AUTH LOADER (BOUNCING BALLS)
──────────────────────────────── */
function showDashboardLoader(text = "Loading dashboard…") {
  if (document.getElementById("authLoading")) return;

  const el = document.createElement("div");
  el.id = "authLoading";
  el.className = "auth-loading";

  el.innerHTML = `
    <div class="auth-loading-card">
      <div class="wrapper">
        <div class="circle"></div>
        <div class="circle"></div>
        <div class="circle"></div>

        <div class="shadow"></div>
        <div class="shadow"></div>
        <div class="shadow"></div>
      </div>
      <div style="margin-top:14px; font-size:0.9rem; color:#cbd5e1;">
        ${text}
      </div>
    </div>
  `;

  document.body.appendChild(el);
}

function hideDashboardLoader() {
  document.getElementById("authLoading")?.remove();
}

/* ───────────────────────────────
   HARD ADMIN ROUTE PROTECTION
──────────────────────────────── */
(async function protectAdminRoute() {
  // Prevent interaction but allow loader visibility
  document.documentElement.style.pointerEvents = "none";
  document.documentElement.style.opacity = "0.6";

  showDashboardLoader();

  const ok = await bootstrapAuth();

  if (!ok || !authStore.isAuthenticated()) {
    hideDashboardLoader();
    window.location.replace("admin-login.html");
    return;
  }

  // Auth confirmed
  hideDashboardLoader();

  renderCurrentUser();

  

  document.documentElement.style.pointerEvents = "auto";
  document.documentElement.style.opacity = "1";
})();

/* ───────────────────────────────
   MOBILE SIDEBAR BEHAVIOR (UNCHANGED)
──────────────────────────────── */
document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-open");
});

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.body.classList.remove("sidebar-open");
  });
});

document.addEventListener("click", (e) => {
  if (!document.body.classList.contains("sidebar-open")) return;

  const sidebar = document.querySelector(".sidebar");
  const menuBtn = document.getElementById("mobileMenuBtn");

  if (sidebar?.contains(e.target) || menuBtn?.contains(e.target)) return;

  document.body.classList.remove("sidebar-open");
});





