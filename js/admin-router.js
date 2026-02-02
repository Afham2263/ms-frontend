// js/admin-router.js
import { fetchSystemStatus } from "./system-status.js";

const content = document.getElementById("contentArea");
const breadcrumb = document.getElementById("breadcrumb");

// ─────────────────────────────
// ROUTES
// ─────────────────────────────
const routes = {
  dashboard() {
  const template = document.getElementById("dashboard-overview-template");
  content.innerHTML = "";
  content.appendChild(template.content.cloneNode(true));

  // 🔥 DESTROY PREVIOUS VIEW (CRITICAL)
  if (window.__currentView?.destroy) {
    window.__currentView.destroy();
    window.__currentView = null;
  }

  // 🔐 Render WhatsApp system status
  renderWhatsAppSystemStatus();

  import("./components/scheduledAnnouncements.js")
    .then(({ ScheduledAnnouncements }) => {
      window.__currentView = new ScheduledAnnouncements({
        mount: document.getElementById("scheduled-announcements"),
        apiBase: "/api"
      });
      window.__currentView.init();
    });

  return null;
},




  campaigns() {
    return `
      <section class="route-shell">
        <h1 class="route-title">Campaign Manager</h1>
        <div class="route-body">
          <div id="campaigns-root"></div>
        </div>
      </section>
    `;
  },

  announcements() {
    return `
      <section class="route-shell">
        <h1 class="route-title">Announcements</h1>
        <div class="route-body">
          <div id="announcements-root"></div>
        </div>
      </section>
    `;
  }
};



import { authStore } from "./authStore.js";

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

// ─────────────────────────────
// INITIAL ROUTE
// ─────────────────────────────
renderRoute("dashboard");

// ─────────────────────────────
// NAVIGATION
// ─────────────────────────────
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelector(".nav-item.active")?.classList.remove("active");
    btn.classList.add("active");
    renderRoute(btn.dataset.route);
  });
});

// ─────────────────────────────
// ROUTER HANDLER
// ─────────────────────────────
function renderRoute(route) {
  // 🔥 HARD CLEANUP OF PREVIOUS VIEW
  if (window.__currentView?.destroy) {
    window.__currentView.destroy();
    window.__currentView = null;
  }

  breadcrumb.textContent =
    route.charAt(0).toUpperCase() + route.slice(1);

  const result = routes[route]?.();

  if (typeof result === "string") {
    content.innerHTML = result;
  }

  if (route === "campaigns") loadCampaignWizard();
  if (route === "announcements") loadAnnouncementWizard();
}

// ─────────────────────────────
// CAMPAIGN WIZARD LOADER
// ─────────────────────────────
function loadCampaignWizard() {
  const root = document.getElementById("campaigns-root");
  if (!root) return;

  import("./components/campaignWizard.js")
    .then(({ CampaignWizard }) =>
      new CampaignWizard({ mount: root, apiBase: "/api" }).init()
    )
    .catch(err => {
      console.error("Failed to load Campaign Wizard", err);
      root.innerHTML = `
        <div class="placeholder">
          Failed to load Campaign Manager. Please try again.
        </div>
      `;
    });
}

// ─────────────────────────────
// ANNOUNCEMENT WIZARD LOADER
// ─────────────────────────────
function loadAnnouncementWizard() {
  const root = document.getElementById("announcements-root");
  if (!root) return;

  import("./components/announcementWizard.js")
    .then(({ AnnouncementWizard }) =>
      new AnnouncementWizard({ mount: root, apiBase: "/api" }).init()
    )
    .catch(err => {
      console.error("Failed to load Announcement Wizard", err);
      root.innerHTML = `
        <div class="placeholder">
          Failed to load Announcements. Please try again.
        </div>
      `;
    });
}

// ─────────────────────────────
// WHATSAPP SYSTEM STATUS (DASHBOARD ONLY)
// ─────────────────────────────
async function renderWhatsAppSystemStatus() {
  const el = document.getElementById("whatsappSystemStatus");
  if (!el) return; // Not on dashboard

  try {
    const { whatsapp_send_enabled } = await fetchSystemStatus();

    if (whatsapp_send_enabled) {
      el.textContent = "System: Message sending enabled";
      el.classList.add("system-status-enabled");
      el.classList.remove("system-status-disabled");
    } else {
      el.textContent = "System: Message sending blocked by System Administrator";
      el.classList.add("system-status-disabled");
      el.classList.remove("system-status-enabled");
    }
  } catch (err) {
    console.error("System status check failed", err);
    el.textContent = "WhatsApp status unavailable";
  }
}


// ─────────────────────────────
// LOGOUT (NEW AUTH SYSTEM)
// ─────────────────────────────
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" } // 🔥 REQUIRED
    );
  } finally {
    // Clear preview flag (dev only)
    localStorage.removeItem("ms_preview_mode");

    // Hard redirect to login
    window.location.replace("admin-login.html");
  }
});
