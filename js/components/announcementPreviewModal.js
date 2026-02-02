// js/components/announcementPreviewModal.js
// ENTERPRISE — Preview Modal Controller

import { renderAnnouncementPreview } from "./announcementPreviewRenderer.js";
import { apiFetch } from "../apiFetch.js";

export class AnnouncementPreviewModal {
  constructor({ apiBase = "/api" } = {}) {
    this.apiBase = apiBase;
    this.el = null;
  }

  async open(announcementId) {
    if (!this.el) this.mount();

    this.el.classList.add("open");
    document.body.style.overflow = "hidden";

    const body = this.el.querySelector(".preview-modal-body");
    body.innerHTML = `<div class="empty-state">Loading preview…</div>`;

    try {
      const res = await apiFetch(
        `${this.apiBase}/announcements/${announcementId}`
      );
      if (!res.ok) throw new Error("Failed to load preview");

      const data = await res.json();
      renderAnnouncementPreview(body, data);
    } catch (e) {
      body.innerHTML =
        `<div class="empty-state">Failed to load preview</div>`;
    }
  }

  close() {
    this.el.classList.remove("open");
    document.body.style.overflow = "";
  }

  mount() {
    this.el = document.createElement("div");
    this.el.className = "preview-modal";

    this.el.innerHTML = `
      <div class="preview-modal-overlay"></div>
      <div class="preview-modal-panel">
        <div class="preview-modal-header">
          <div class="preview-title">Announcement Preview</div>
          <button class="preview-close">✕</button>
        </div>
        <div class="preview-modal-body"></div>
      </div>
    `;

    document.body.appendChild(this.el);

    this.el.querySelector(".preview-close").onclick = () => this.close();
    this.el.querySelector(".preview-modal-overlay").onclick = () => this.close();

    window.addEventListener("keydown", e => {
      if (e.key === "Escape") this.close();
    });
  }
}
