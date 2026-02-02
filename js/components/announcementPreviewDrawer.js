// js/components/announcementPreviewDrawer.js
import { SchedulerModal } from "./schedulerModal.js";
import { apiFetch } from "../apiFetch.js";

export class AnnouncementPreviewDrawer {
  constructor({ apiBase = "/api" }) {
  this.apiBase = apiBase;
  this.el = null;
  this.data = null;
  this._scheduler = null; // init later with mount
}

  async open(id) {
    if (this.el) this.close();

    const res = await apiFetch(`${this.apiBase}/announcements/${id}`);
    if (!res.ok) {
      alert("Failed to load announcement preview");
      return;
    }

    this.data = await res.json();
    this.render();
  }

  render() {
  // 🔥 HARD RESET — prevents stacked drawers & phantom spacing
  if (this.el) {
    this.el.remove();
    this.el = null;
  }

  this.el = document.createElement("div");
  this.el.className = "dashboard-preview-drawer drawer-overlay";

  // Scheduler MUST mount to drawer root
  this._scheduler = new SchedulerModal({ mount: this.el });

  const title = this.escape(
    this.data.template_display_name || "Announcement"
  );

  const scheduled = new Date(this.data.scheduled_at).toLocaleString();

  const mediaHTML = this.renderMedia()
    ? `<div class="wa-media">${this.renderMedia()}</div>`
    : "";

  this.el.innerHTML =
`<div class="drawer-panel">
  <div class="drawer-header">
    <div>
      <div class="drawer-title">${title}</div>
      <div class="drawer-sub">Scheduled · ${scheduled}</div>
    </div>
    <button class="drawer-close" aria-label="Close">✕</button>
  </div>

  <div class="drawer-body">
    <div class="wa-bubble">${mediaHTML}<div class="wa-text">${this.renderBodyText()}</div></div>
    ${this.renderAudienceInfo() || ""}
  </div>

  <div class="drawer-footer">
    <button class="btn outline" id="editSchedule">Edit schedule</button>
    <button class="btn danger" id="deleteAnnouncement">Delete</button>
  </div>
</div>`;

  document.body.appendChild(this.el);

  // Overlay click closes (panel excluded)
  this.el.addEventListener("click", e => {
    if (e.target === this.el) this.close();
  });

  this.el.querySelector(".drawer-close").onclick = () => this.close();

  this.el.querySelector("#editSchedule").onclick = () => {
    this._scheduler.open({
      scheduledAt: this.data.scheduled_at,
      onSave: newDate => this.updateSchedule(newDate)
    });
  };

  this.el.querySelector("#deleteAnnouncement").onclick = () => {
    if (confirm("Delete this scheduled announcement?")) {
      this.delete();
    }
  };
}

  renderMedia() {
    const m = this.data.media;
    if (!m || !m.url) return "";

    if (m.type === "image") {
      return `<img class="drawer-media" src="${m.url}" />`;
    }

    if (m.type === "video") {
      return `
        <video class="drawer-media" controls>
          <source src="${m.url}" />
        </video>
      `;
    }

    if (m.type === "document") {
      return `
        <a class="drawer-doc" href="${m.url}" target="_blank">
          📄 View document
        </a>
      `;
    }

    return "";
  }

  async updateSchedule(scheduledAt) {
  const id = this.data?.id;
  if (!id) return;

  const res = await apiFetch(
    `${this.apiBase}/announcements/${id}/schedule`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt })
    }
  );

  if (!res.ok) {
    alert("Failed to update schedule");
    return;
  }

  // 🔄 update local state BEFORE closing
  this.data.scheduled_at = scheduledAt;

  // 🔒 DO NOT destroy drawer — keep preview open
  this.render(); // re-render with updated time
}


  async delete() {
    const res = await apiFetch(
      `${this.apiBase}/announcements/${this.data.id}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      alert("Delete failed");
      return;
    }

    this.close();
    location.reload();
  }

  renderBodyText() {
  let text = this.data.preview_text || this.data.body_text || "";
  const vars = this.data.body_params || [];

  // 🔒 Normalize whitespace EXACTLY like wizard
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const val = vars[idx - 1];
    return val
      ? `<span class="wa-var">${this.escape(val)}</span>`
      : "";
  });
}


renderAudienceInfo() {
  const audience = this.data.audience;
  if (!audience) return "";

  const { estimated_count, display_paths = [] } = audience;

  return `
    <div class="drawer-audience">
      <div class="drawer-audience-label">Recipients</div>

      <div class="drawer-audience-value">
        Estimated <strong>${estimated_count}</strong> recipients
      </div>

      ${display_paths.length ? `
        <div class="drawer-audience-paths">
          ${display_paths.map(path => `
            <div class="audience-path">
              ${path.map((node, i) => `
                <div
                  class="audience-node"
                  style="padding-left:${i * 14}px"
                >
                  ${i === 0 ? "•" : "└"} ${this.escape(node)}
                </div>
              `).join("")}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}
  



  close() {
    this.el?.remove();
    this.el = null;
    this.data = null;
  }

    destroy() {
    this.close();
  }


  escape(s) {
    return String(s || "").replace(/[&<>"']/g, c =>
      ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
    );
  }
}

 