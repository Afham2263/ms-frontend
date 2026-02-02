// js/components/mediaManager.js
// ENTERPRISE MEDIA MANAGER — Campaigns / Announcements
// Responsibilities: list, upload, delete, select media
// Emits: media:selected
//
// GUARANTEES:
// - Upload flow untouched (POST /api/media-assets, FormData)
// - Polling logic untouched
// - Selection → audience navigation preserved
// - All requested UX upgrades implemented cleanly
import { apiFetch } from "../apiFetch.js";

export class MediaManager {
  constructor({ mount, apiBase = "/api", scope, mediaType, templateName = "Template" }) {
    if (!mount) throw new Error("MediaManager requires mount element");
    if (!scope) throw new Error("MediaManager requires scope");
    if (!mediaType) throw new Error("MediaManager requires mediaType");

    this.mount = mount;
    this.apiBase = apiBase;
    this.scope = scope;
    this.mediaType = mediaType;
    this.templateName = templateName;

    this.state = {
      media: [],
      loading: false,
      uploading: false,
      uploadProgress: 0,
      search: ""
    };

    this._pollTimer = null;
    this._loadingInFlight = false;
    this._hoveringPreview = false;

  }

  async init() {
    this.renderShell();
    await this.loadMedia();
    this.bind();
  }

  // ----------------------------
  // Data
  // ----------------------------

  async loadMedia() {
    if (this._loadingInFlight) return;
    this._loadingInFlight = true;

    this.state.loading = true;
    this.renderList();

    try {
      const res = await  apiFetch(
        `${this.apiBase}/media-assets?scope=${this.scope}&media_type=${this.mediaType}`
      );
      const json = await res.json();
      this.state.media = json.media || [];
    } catch {
      this.state.media = [];
    }

    this.state.loading = false;
    this._loadingInFlight = false;
    this.renderList();

        if (
      this.state.media.length > 0 &&
      this.state.media.some(m => m.status !== "ready")
    ) {
      this.startPolling();
    } else {
      this.stopPolling();
    }

  }

  startPolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => this.loadMedia(), 4000);
  }

  stopPolling() {
    if (!this._pollTimer) return;
    clearInterval(this._pollTimer);
    this._pollTimer = null;
  }

  async uploadFile(file) {
    if (!file || this.state.uploading) return;

    const type = file.type;
    const sizeMB = file.size / (1024 * 1024);

    if (this.mediaType === "image" && !["image/png", "image/jpeg"].includes(type))
      return alert("Only PNG and JPEG images are supported.");

    if (this.mediaType === "video" && type !== "video/mp4")
      return alert("Only MP4 videos are supported.");

    if (this.mediaType === "document" && type !== "application/pdf")
      return alert("Only PDF documents are supported.");

    if (this.mediaType === "image" && sizeMB > 5)
      return alert("Images must be 5 MB or smaller.");

    if (this.mediaType === "video" && sizeMB > 16)
      return alert("Videos must be 16 MB or smaller.");

    if (this.mediaType === "document" && sizeMB > 100)
      return alert("PDF files must be 100 MB or smaller.");

    this.state.uploading = true;
    this.state.uploadProgress = 20;
    this.renderList();

    const fd = new FormData();
    fd.append("file", file);
    fd.append("scope", this.scope);
    fd.append("media_type", this.mediaType);

    try {
      await apiFetch(`${this.apiBase}/media-assets`, {
        method: "POST",
        body: fd
      });
      this.state.uploadProgress = 100;
    } catch {
      alert("Upload failed.");
    }

    this.state.uploading = false;
    this.state.uploadProgress = 0;
    await this.loadMedia();
  }

  async deleteMedia(id) {
  if (!confirm("Delete this media permanently?")) return;

  try {
    await apiFetch(`${this.apiBase}/media-assets/${id}`, { method: "DELETE" });
  } catch (err) {
    // 404 = already deleted or not owned → treat as success
    if (err?.message?.includes("404")) {
      // swallow
    } else {
      alert("Failed to delete media.");
      return;
    }
  }

  await this.loadMedia();
}

  // ----------------------------
  // Rendering
  // ----------------------------

  renderShell() {
    this.mount.innerHTML = `
      <div class="media-manager panel">
        <div class="media-header">
          <button class="back-btn" type="button">← Back</button>

          <div class="media-title">
            <h2>Select ${this.label()} for ${this.escape(this.templateName)}</h2>
          </div>

          <div class="media-actions">
            <input
              type="search"
              class="media-search"
              placeholder="Search ${this.label()}…"
            />
            <button class="upload-btn" type="button">Upload ${this.label()}</button>
            <input type="file" hidden />
          </div>
        </div>

        <div class="media-dropzone" id="mediaDropzone">
          <div class="media-list" id="mediaList"></div>
        </div>
      </div>

      <div class="media-preview-panel hidden" id="mediaPreviewPanel"></div>
    `;

    this.fileInput = this.mount.querySelector("input[type=file]");
    this.uploadBtn = this.mount.querySelector(".upload-btn");
    this.listEl = this.mount.querySelector("#mediaList");
    this.dropZone = this.mount.querySelector("#mediaDropzone");
    this.previewPanel = this.mount.querySelector("#mediaPreviewPanel");
    this.searchInput = this.mount.querySelector(".media-search");

    this.fileInput.accept = this.acceptAttr();
  }

  renderList() {
    if (this.state.uploading) {
      this.listEl.innerHTML = `
        <div class="media-uploading">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${this.state.uploadProgress}%"></div>
          </div>
          <div class="muted">Uploading…</div>
        </div>
      `;
      return;
    }

    if (this.state.loading) {
      this.listEl.innerHTML = `<div class="media-empty">Loading…</div>`;
      return;
    }

    const filtered = this.state.media.filter(m =>
      m.filename.toLowerCase().includes(this.state.search)
    );

    if (!filtered.length) {
      this.listEl.innerHTML = `
        <div class="media-empty">
        ${this.emptyEmoji()}
        <div class="media-empty-title">
          No ${this.label().toLowerCase()} uploaded yet
        </div>
        <div class="media-empty-sub">
          Upload a ${this.label().toLowerCase()} to use it in this ${this.scope}.
        </div>
      </div>

      `;
      return;
    }

    this.listEl.innerHTML = filtered.map(m => this.renderCard(m)).join("");
  }

  renderCard(m) {
    const thumb =
      m.status === "ready" && m.preview_url
        ? this.mediaType === "image"
          ? `<img src="${m.preview_url}" />`
          : this.mediaType === "video"
          ? `<video src="${m.preview_url}" muted preload="metadata"></video>`
          : `<span class="media-icon">📄</span>`
        : `<span class="media-icon">${this.cardEmoji()}</span>`;

    return `
      <div class="media-card ${m.status !== "ready" ? "disabled" : ""}" data-id="${m.id}">
        <div class="media-thumb">${thumb}</div>

        <div class="media-meta">
          <div class="media-name">${this.escape(m.filename)}</div>
          <div class="media-status ${m.status}">${m.status}</div>
        </div>

        <button class="media-delete" title="Delete">
          <svg viewBox="0 0 24 24" class="trash-icon">
            <path d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/>
          </svg>
        </button>
      </div>
    `;
  }

  // ----------------------------
  // Preview
  // ----------------------------

  showPreview(media, x, y) {
  if (!media || !media.preview_url) return;

  // 🚫 Prevent re-render of same media
  if (this._activePreviewId === media.id) return;
  this._activePreviewId = media.id;

  let body = "";

  if (this.mediaType === "image") {
    body = `<img src="${media.preview_url}" />`;
  } 
  else if (this.mediaType === "video") {
    body = `
      <video autoplay muted loop playsinline>
        <source src="${media.preview_url}" type="video/mp4" />
      </video>
    `;
  } 
  else {
    body = `
      <div class="pdf-preview">
        <a href="${media.preview_url}" target="_blank" rel="noopener">
          Open full PDF →
        </a>
      </div>
    `;
  }

  this.previewPanel.innerHTML = `
    <div class="preview-header">${this.escape(media.filename)}</div>
    <div class="preview-body">${body}</div>
  `;

  const OFFSET_X = 24;
  const OFFSET_Y = 16;

  this.previewPanel.classList.remove("hidden");

  // 🔒 Clamp to viewport (enterprise-grade)
  const rect = this.previewPanel.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 8;
  const maxY = window.innerHeight - rect.height - 8;

  this.previewPanel.style.left = `${Math.min(x + OFFSET_X, maxX)}px`;
  this.previewPanel.style.top  = `${Math.min(y + OFFSET_Y, maxY)}px`;
  this.previewPanel.style.right = "auto";
}


  hidePreview() {
  this._activePreviewId = null;   // ← REQUIRED
  this.previewPanel.classList.add("hidden");
}



  // ----------------------------
  // Events
  // ----------------------------

  bind() {

  // ----------------------------
  // Back
  // ----------------------------
  const backBtn = this.mount.querySelector(".back-btn");
  if (backBtn) {
    backBtn.onclick = () => {
      window.dispatchEvent(new CustomEvent("media:back"));
    };
  }

  // ----------------------------
  // Upload
  // ----------------------------
  this.uploadBtn.onclick = () => this.fileInput.click();

  this.fileInput.onchange = e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) this.uploadFile(file);
  };

  // ----------------------------
  // Search
  // ----------------------------
  this.searchInput.oninput = e => {
    this.state.search = e.target.value.toLowerCase();
    this.renderList();
  };

  // ----------------------------
  // Drag & Drop
  // ----------------------------
  this.dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    this.dropZone.classList.add("drag-over");
  });

  this.dropZone.addEventListener("dragleave", () => {
    this.dropZone.classList.remove("drag-over");
  });

  this.dropZone.addEventListener("drop", e => {
    e.preventDefault();
    this.dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) this.uploadFile(file);
  });

  // ----------------------------
  // 🧠 ENTERPRISE PREVIEW (CORRECT)
  // ----------------------------
  let activeCardId = null;
  let hoveringCard = false;
  let hoveringPreview = false;

  const maybeHide = () => {
    if (!hoveringCard && !hoveringPreview) {
      activeCardId = null;
      this.hidePreview();
    }
  };

  // Card enter → show preview ONCE
  this.mount.addEventListener(
    "mouseenter",
    e => {
      const card = e.target.closest(".media-card");
      if (!card) return;

      hoveringCard = true;

      const id = card.dataset.id;
      if (id === activeCardId) return; // same card → no rerender
      activeCardId = id;

      const media = this.state.media.find(m => m.id === id);
      if (!media || media.status !== "ready") return;

      // Position preview near cursor ONCE
      this.showPreview(media, e.clientX + 16, e.clientY + 16);
    },
    true
  );

  // Card leave
  this.mount.addEventListener(
    "mouseleave",
    e => {
      if (!e.target.closest(".media-card")) return;
      hoveringCard = false;
      setTimeout(maybeHide, 60);
    },
    true
  );

  // Preview hover lock
  this.previewPanel.addEventListener("mouseenter", () => {
    hoveringPreview = true;
  });

  this.previewPanel.addEventListener("mouseleave", () => {
    hoveringPreview = false;
    setTimeout(maybeHide, 60);
  });

  // ----------------------------
  // Select Media
  // ----------------------------
  this.mount.addEventListener("click", e => {
    if (e.target.closest(".media-delete")) return;

    const card = e.target.closest(".media-card");
    if (!card) return;

    const media = this.state.media.find(m => m.id === card.dataset.id);
    if (!media || media.status !== "ready") return;

    window.dispatchEvent(
      new CustomEvent("media:selected", {
      detail: {
        mediaAssetId: media.id,
        mediaUrl: media.preview_url || media.url,
        mediaType: this.mediaType
      }
})
    );
  });

  // ----------------------------
  // Delete Media
  // ----------------------------
  this.mount.addEventListener("click", e => {
    const btn = e.target.closest(".media-delete");
    if (!btn) return;

    e.stopPropagation();
    const card = btn.closest(".media-card");
    if (card) this.deleteMedia(card.dataset.id);
  });

  // ----------------------------
  // Cleanup
  // ----------------------------
  window.addEventListener("beforeunload", () => this.stopPolling());
}



  // ----------------------------
  // Helpers
  // ----------------------------

  label() {
    return this.mediaType === "document" ? "PDF" : this.mediaType;
  }

  acceptAttr() {
    if (this.mediaType === "image") return "image/png,image/jpeg";
    if (this.mediaType === "video") return "video/mp4";
    return "application/pdf";
  }

  cardEmoji() {
    return this.mediaType === "image" ? "🖼️" :
           this.mediaType === "video" ? "🎥" : "📄";
  }

  emptyEmoji() {
    return this.cardEmoji();
  }

  destroy() {
  this.stopPolling();
  this.state.media = [];
  this.mount.innerHTML = "";
}
  escape(s) {
    return String(s || "").replace(/[&<>"']/g, c =>
      ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
    );
  }
}
