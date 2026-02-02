// js/components/announcementWizard.js
// FINAL — ENTERPRISE UX (PIXEL-PARITY WITH CAMPAIGNS)
// LOCKED: no refactors, no removed logic
// CHANGE ONLY:
// 1) REMOVE "Next" button on Step 1 (template auto-advances)
// 2) HIDE Summary sidebar on Step 1 (show from Audience onwards

import { SchedulerModal } from "./schedulerModal.js";
import { apiFetch } from "../apiFetch.js";

export class AnnouncementWizard {
  constructor({ mount, apiBase = "/api", storageKey = "ms_announcement_v1" } = {}) {
    if (!mount) throw new Error("AnnouncementWizard requires a mount element");

    this.mount = mount;
    this.apiBase = apiBase;
    this.storageKey = storageKey;

    this.state = {
      media: { assetId: null },
      step: 1,
      templates: [],
      filteredTemplates: [],
      template: null,
      audience: { selected: [], estimated: 0 },
      variables: [],
      sending: false,
      search: "",
      category: "all"
      
    };

    this._scheduler = new SchedulerModal();
    this.onAudienceSelected = this.onAudienceSelected.bind(this);
    this._cardHover = false;
    this._hoverInside = false;
  }

  async init() {
  // 🔒 CORRECT GLOBAL BINDING
  window.__announcementWizard = this;

  // 🔒 HARD RESET — no draft persistence
  localStorage.removeItem(this.storageKey);

  this.mount.classList.add("wizard-shell");
  this.mount.innerHTML = this.layout();
  this.bind();

  await this.loadTemplates();
  this.applyFilters();
  this.render();
}


  layout() {
    return `
      <link rel="stylesheet" href="css/campaign.css">
      <link rel="stylesheet" href="css/templates.css">

      <div class="wizard panel">
        <div class="wizard-steps">
          <div class="step-pill" data-step="1">Template</div>
          <div class="step-connector"></div>
          <div class="step-pill" data-step="2">Media</div>
          <div class="step-connector"></div>
          <div class="step-pill" data-step="3">Audience</div>
          <div class="step-connector"></div>
          <div class="step-pill" data-step="4">Review & Send</div>
        </div>

        <div class="wizard-body">
          <div class="wizard-left panel" id="stepPane"></div>
          <aside class="wizard-right panel" id="summaryPane">
            <div class="small-muted">Announcement Summary</div>
            <div id="summaryList" class="summary-list"></div>
          </aside>
        </div>

        <div class="btn-row">
          <button id="prevBtn" class="btn ghost">Back</button>
          <button id="nextBtn" class="btn primary">Next</button>
        </div>
      </div>

      <div id="tplPreviewPanel" class="tpl-preview-panel hidden"></div>
    `;
  }

  bind() {
    this.stepPane = this.mount.querySelector("#stepPane");
    this.summaryPane = this.mount.querySelector("#summaryPane");
    this.summaryList = this.mount.querySelector("#summaryList");
    this.prevBtn = this.mount.querySelector("#prevBtn");
    this.nextBtn = this.mount.querySelector("#nextBtn");
    this.stepsBar = [...this.mount.querySelectorAll(".step-pill")];
    this.connectors = [...this.mount.querySelectorAll(".step-connector")];
    this.previewPanel = this.mount.querySelector("#tplPreviewPanel");

    this.prevBtn.onclick = () => this.prev();
    this.nextBtn.onclick = () => this.next();

    this.stepsBar.forEach(pill => {
      pill.onclick = () => {
        const target = Number(pill.dataset.step);
        if (target < this.state.step) {
          this.state.step = target;
          this.saveDraft();
          this.render();
        }
      };
    });

    this.previewPanel.addEventListener("mouseenter", () => (this._hoverInside = true));
    this.previewPanel.addEventListener("mouseleave", () => {
      this._hoverInside = false;
      this.maybeHidePreview();
    });
  }

  async loadTemplates() {
    try {
      const res = await fetch(`${this.apiBase}/announcement-templates`);
      if (!res.ok) throw new Error("Failed to load announcement templates");
      const list = await res.json();

      this.state.templates = list.map(t => ({
        id: t.id,
        name: t.purpose || t.meta_template_name || "Announcement",
        category: t.category,
        preview_text: t.body_text || "",
        media: t.has_header
          ? {
              type:
                t.header_type === "IMAGE"
                  ? "image"
                  : t.header_type === "VIDEO"
                  ? "video"
                  : "document",
              url: t.header_preview_url
            }
          : null,
        body_param_count: t.body_param_count || 0,
        has_body_params: t.has_body_params,
        is_warmup_template: t.is_warmup_template
      }));
    } catch (err) {
      console.error(err);
      this.state.templates = [];
    }
  }

  applyFilters() {
    const q = this.state.search.toLowerCase();
    const cat = this.state.category;

    this.state.filteredTemplates = this.state.templates.filter(t =>
      (t.name.toLowerCase().includes(q) ||
        t.preview_text.toLowerCase().includes(q)) &&
      (cat === "all" || t.category === cat)
    );
  }

  renderTemplates() {
    this.stepPane.innerHTML = `
      <div class="tpl-toolbar">
        <input class="tpl-search" placeholder="Search templates…" />
        <select class="tpl-filter"></select>
      </div>
      <div class="tpl-list" id="tplList"></div>
    `;

    this.renderTemplateToolbar();
    this.renderTemplateList();
  }

  renderTemplateToolbar() {
    const search = this.stepPane.querySelector(".tpl-search");
    const filter = this.stepPane.querySelector(".tpl-filter");

    const categories = [...new Set(this.state.templates.map(t => t.category))];

    search.value = this.state.search;
    filter.innerHTML =
      `<option value="all">All categories</option>` +
      categories.map(c => `<option>${this.escape(c)}</option>`).join("");
    filter.value = this.state.category;

    search.oninput = e => {
      this.state.search = e.target.value;
      this.applyFilters();
      this.renderTemplateList();
    };

    filter.onchange = e => {
      this.state.category = e.target.value;
      this.applyFilters();
      this.renderTemplateList();
    };
  }

  renderTemplateList() {
    const list = this.stepPane.querySelector("#tplList");

    if (!this.state.filteredTemplates.length) {
      list.innerHTML = `<div class="placeholder">No announcement templates available.</div>`;
      return;
    }

    list.innerHTML = this.state.filteredTemplates.map(t => `
      <div class="tpl-row ${this.state.template?.id === t.id ? "selected" : ""}" data-id="${t.id}">
        ${this.renderMediaThumb(t)}
        <div class="tpl-info">
          <div class="tpl-title">${this.escape(t.name)}</div>
          <span class="tpl-cat">${this.escape(t.category)}</span>
          ${t.is_warmup_template ? `<div class="tpl-text">🔔 Warm-up / Opt-in Template</div>` : ""}
        </div>
      </div>
    `).join("");

    list.querySelectorAll(".tpl-row").forEach(row => {
      const tpl = this.state.filteredTemplates.find(t => t.id === row.dataset.id);
      row.onmouseenter = () => {
        this._cardHover = true;
        this.showPreview(tpl);
      };
      row.onmouseleave = () => {
        this._cardHover = false;
        this.maybeHidePreview();
      };
      row.onclick = () => this.selectTemplate(tpl.id);
    });
  }

  renderMediaThumb(tpl) {
  const mediaType =
    this.getTemplateMediaType?.(tpl) ||
    tpl?.media?.type ||
    null;

  // 📩 TEXT-ONLY TEMPLATE
  if (!mediaType) {
    return `
      <div class="tpl-media icon text-only">
        <span class="media-emoji">📩</span>
      </div>
    `;
  }

  const map = {
    image: "🖼️",
    video: "🎥",
    document: "📄"
  };

  return `
    <div class="tpl-media icon">
      <span class="media-emoji">${map[mediaType]}</span>
    </div>
  `;
}


  selectTemplate(id) {
    this.state.template = this.state.templates.find(t => t.id === id);
    this.state.variables = this.state.template?.has_body_params
     ? Array.from(
      { length: Number(this.state.template.body_param_count) || 0 },
      () => ""
    )
  : [];
    this.state.media = { assetId: null, url: null, type: null };


    this.saveDraft();
    this.hidePreview();

    this.state.step = 2;

    this.render();
  }

  hidePreview() {
    this.previewPanel.classList.add("hidden");
    this._cardHover = false;
  }

  maybeHidePreview() {
    if (this.state.step !== 1) return;
    setTimeout(() => {
      if (!this._cardHover && !this._hoverInside) {
        this.previewPanel.classList.add("hidden");
      }
    }, 120);
  }

  showPreview(tpl) {
    if (!tpl) return;

    this.previewPanel.innerHTML = `
      <div class="preview-header">
        <div class="preview-title">${this.escape(tpl.name)}</div>
        <div class="preview-sub">${this.escape(tpl.category || "")}</div>
      </div>
      ${this.renderMediaPreview(tpl)}
      <div class="wa-bubble">
        <div class="wa-text">${this.escape(tpl.preview_text)}</div>
      </div>
    `;
    this.previewPanel.classList.remove("hidden");
  }

  renderMediaPreview(tpl) {
  const mediaType =
    this.getTemplateMediaType?.(tpl) ||
    tpl?.media?.type ||
    null;

  // ❌ TEXT-ONLY → NO POPUP PREVIEW
  if (!mediaType) {
    return "";
  }

  const map = {
    image: { icon: "🖼️", label: "Image Template" },
    video: { icon: "🎥", label: "Video Template" },
    document: { icon: "📄", label: "Document Template" }
  };

  const m = map[mediaType];

  return `
    <div class="tpl-preview-placeholder ${mediaType}">
      <div class="tpl-preview-icon">${m.icon}</div>
      <div class="tpl-preview-label">${m.label}</div>
    </div>
  `;
}


  async renderMediaSelection() {
  const mediaType = this.state.template?.media?.type;

  // 🧠 TEXT-ONLY ANNOUNCEMENT (NO HEADER)
  if (!mediaType) {
    this.stepPane.innerHTML = `
      <div class="panel" style="padding:24px; text-align:center;">
        <div style="font-size:18px; font-weight:600; margin-bottom:8px;">
          No media required
        </div>
        <div class="small-muted" style="max-width:420px; margin:0 auto;">
          This announcement template does not include a header image, video, or document.
          You can continue directly to audience selection.
        </div>

        <div style="margin-top:24px;">
          <button class="btn primary" id="continueToAudience">
            Continue
          </button>
        </div>
      </div>
    `;

    this.stepPane
      .querySelector("#continueToAudience")
      .onclick = () => {
        this.state.step = 3; // Audience
        this.saveDraft();
        this.render();
      };

    return;
  }

  // 🧩 MEDIA REQUIRED — show MediaManager
  this.stepPane.innerHTML = `
    <link rel="stylesheet" href="css/media-manager.css">
    <div id="mediaMount"></div>
  `;

  const { MediaManager } = await import("./mediaManager.js");

  this._mediaMgr = new MediaManager({
    mount: this.stepPane.querySelector("#mediaMount"),
    apiBase: this.apiBase,
    scope: "announcement",
    mediaType,
    templateName: this.state.template.name
  });

  await this._mediaMgr.init();

  window.addEventListener(
    "media:selected",
    e => {
      this.state.media = {
      assetId: e.detail.mediaAssetId,
      url: e.detail.mediaUrl,
      type: e.detail.mediaType
    };
      this.state.step = 3;
      this.saveDraft();
      this.render();
    },
    { once: true }
  );

  window.addEventListener(
    "media:back",
    () => {
      this.state.step = 1;
      this.saveDraft();
      this.render();
    },
    { once: true }
  );
}


  renderAudience() {
    this.stepPane.innerHTML = `
      <div class="audience-shell">
        <div class="audience-header">
          <h2>Select Audience</h2>
        </div>
        <div class="audience-tree-wrapper panel">
          <div id="audienceMount"></div>
        </div>
      </div>
    `;

    import("./audienceTree.js").then(({ AudienceTree }) => {
      this._aud = new AudienceTree({
        mount: this.stepPane.querySelector("#audienceMount"),
        apiBase: this.apiBase
      });
      this._aud.init();
      window.addEventListener("audience:selected", this.onAudienceSelected);
    });
  }

  onAudienceSelected(e) {
    this.state.audience = e.detail;
    this.saveDraft();
    this.renderSummary();
  }

  renderReview() {
  const t = this.state.template;

  const previewHTML = t.preview_text.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const val = this.state.variables[idx - 1];
    return val
      ? `<span class="wa-var">${this.escape(val)}</span>`
      : `<span class="wa-var placeholder">Var ${idx}</span>`;
  });

  this.stepPane.innerHTML = `
    <!-- TOP LEFT BACK -->
    <div class="review-header">
      <button class="review-back-btn" id="reviewBackBtn">
        <span class="back-icon">←</span>
        <span class="back-text">Back to Audience</span>
      </button>
    </div>


    <div class="preview-disclaimer">
      <span class="info-dot">i</span>
      <span>
        Footer elements and action buttons are not shown in this preview.
      </span>
    </div>

    <div class="review-layout">
      <div class="review-preview">
        ${this.renderSelectedMediaPreview()}
        <div class="wa-bubble large">
          <div class="wa-text">${previewHTML}</div>
        </div>
      </div>
    </div>

    ${t.has_body_params ? `
      <div class="var-section">
        <div class="var-title">Template variables</div>
        <div class="var-list">
          ${this.state.variables.map((v, i) => `
            <div class="var-row">
              <label>Variable ${i + 1}</label>
              <input
                class="var-input"
                value="${this.escape(v)}"
                oninput="window.__announcementWizard.updateVar(${i}, this.value)"
              />
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
  `;

  // Bind back
  this.stepPane.querySelector("#reviewBackBtn").onclick = () => this.prev();
}


  updateVar(i, v) {
  // 🔒 Normalize input
  this.state.variables[i] = v ?? "";

  const t = this.state.template;
  if (!t) return;

  const previewHTML = t.preview_text.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const val = this.state.variables[idx - 1];
    return val && val.trim()
      ? `<span class="wa-var">${this.escape(val)}</span>`
      : `<span class="wa-var placeholder">Var ${idx}</span>`;
  });

  // 🔥 Force preview refresh
  const bubble = this.stepPane.querySelector(".wa-text");
  if (bubble) {
    bubble.innerHTML = previewHTML;
  }
}

  renderSelectedMediaPreview() {
  const m = this.state.media;
  if (!m || !m.url) return "";

  if (m.type === "image") {
    return `
      <div class="review-media">
        <img src="${m.url}" alt="Selected image" />
      </div>
    `;
  }

  if (m.type === "video") {
    return `
      <div class="review-media">
        <video
          src="${m.url}"
          controls
          preload="metadata"
          style="max-width:100%; border-radius:12px;"
        ></video>
      </div>
    `;
  }

  if (m.type === "document") {
    return `
      <div class="review-media doc">
        <a href="${m.url}" target="_blank" rel="noopener">
          📄 View selected document
        </a>
      </div>
    `;
  }

  return "";
}


  render() {
    if (this.state.step !== 1) this.hidePreview();

    this.stepsBar.forEach(p => {
      const s = Number(p.dataset.step);
      p.classList.toggle("active", s === this.state.step);
      p.classList.toggle("completed", s < this.state.step);
      p.classList.toggle("inactive", s > this.state.step);
    });

    this.connectors.forEach((conn, index) => {
      conn.classList.toggle("completed", index < this.state.step - 1);
    });

    if (this.state.step === 1) this.renderTemplates();
    if (this.state.step === 2) this.renderMediaSelection();
    if (this.state.step === 3) this.renderAudience();
    if (this.state.step === 4) this.renderReview();

    // ================= BUTTON VISIBILITY RULES =================

// Media step: buttons controlled internally
if (this.state.step === 2) {
  this.prevBtn.style.display = "none";
  this.nextBtn.style.display = "none";
} else {
  // Footer Back is NEVER shown on Review
  this.prevBtn.style.display =
    this.state.step > 1 && this.state.step !== 4 ? "inline-block" : "none";

  // Footer Next
  this.nextBtn.style.display =
    this.state.step === 1 ? "none" : "inline-block";

  this.nextBtn.textContent =
    this.state.step === 4 ? "Send Now" : "Next";
}

// ================= SUMMARY VISIBILITY =================

if (this.state.step === 2 || this.state.step === 1) {
  this.summaryPane.style.display = "none";
} else {
  this.summaryPane.style.display = "block";
}

// ================= SCHEDULE BUTTON (REVIEW ONLY) =================

if (this.state.step === 4) {
  if (!this._scheduleBtn) {
    this._scheduleBtn = document.createElement("button");
    this._scheduleBtn.className = "btn outline";
    this._scheduleBtn.textContent = "Schedule";

    this._scheduleBtn.onclick = () => {
    if (
      this.state.template.has_body_params &&
      this.state.variables.some(v => !v.trim())
    ) {
      alert("Fill all template variables before scheduling");
      return;
    }

  this._scheduler.open({
    onSave: scheduledAt => {
      this.submit(scheduledAt);
    }
  });
};


    this.nextBtn.parentNode.insertBefore(
      this._scheduleBtn,
      this.nextBtn
    );
  }
} else {
  if (this._scheduleBtn) {
    this._scheduleBtn.remove();
    this._scheduleBtn = null;
  }
}



    this.renderSummary();
  }

  renderSummary() {
    if (this.state.step === 1) {
      this.summaryList.innerHTML = "";
      return;
    }

    this.summaryList.innerHTML = `
      <div class="summary-item">
        <span>Template</span>
        <strong>${this.state.template?.name || "—"}</strong>
      </div>
      <div class="summary-item">
        <span>Audience</span>
        <strong>${this.state.audience.selected.length}</strong>
      </div>
      <div class="summary-item">
        <span>Estimated Reach</span>
        <strong>${this.state.audience.estimated || 0}</strong>
      </div>
    `;
  }

  next() {
  // Step 2 → Audience validation
  if (this.state.step === 2 && !this.state.audience.selected.length) {
    return alert("Select at least one audience");
  }

  // Step 4 → FINAL submit
  if (this.state.step === 4) {
    if (
      this.state.template.has_body_params &&
      this.state.variables.some(v => !v.trim())
    ) {
      return alert("Fill all variables");
    }
    return this.submit();
  }

  // Normal step advance
  this.state.step++;
  this.saveDraft();
  this.render();
}


  prev() {
    if (this.state.step > 1) {
      this.state.step--;
      this.saveDraft();
      this.render();
    }
  }

  submit(scheduledAt = null) {
  const payload = {
    templateId: this.state.template.id,
    mediaAssetId: this.state.media.assetId || null,
    audienceNodeIds: this.state.audience.selected,
    scheduledAt
  };

  if (this.state.template.has_body_params) {
    payload.bodyParams = [...this.state.variables];
  }

  apiFetch(`${this.apiBase}/announcements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(console.error);

  // 🔔 SIGNAL DASHBOARD TO START SMART REFRESH
  window.dispatchEvent(
    new CustomEvent("announcement:queued", {
      detail: {
        scheduledAt,
        templateName: this.state.template.name
      }
    })
  );

  alert("Announcement queued successfully");
  localStorage.removeItem(this.storageKey);
  location.href = "/dashboard-admin.html";
}



  saveDraft() {
    // ❌ Draft persistence intentionally disabled
  }


  escape(s) {
    return String(s || "").replace(/[&<>"']/g, c =>
      ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
    );
  }
}


