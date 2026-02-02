// js/components/campaignWizard.js
// FINAL — ENTERPRISE UX + STABLE LOGIC (MEDIA STEP GUARANTEED + PLACEHOLDERS FIXED)
import { apiFetch } from "../apiFetch.js";

export class CampaignWizard {
  constructor({ mount, apiBase = "/api", storageKey = "ms_campaign_final_v1" } = {}) {
    if (!mount) throw new Error("CampaignWizard requires a mount element");

    this.mount = mount;
    this.apiBase = apiBase;
    this.storageKey = storageKey;

    this.state = {
      step: 1,
      templates: [],
      filteredTemplates: [],
      template: null,
      media: { assetId: null },
      audience: { selected: [], estimated: 0 },
      variables: [],
      sending: false,
      search: "",
      category: "all"
    };

    this.onAudienceSelected = this.onAudienceSelected.bind(this);
    this._cardHover = false;
    this._hoverInside = false;
  }

  async init() {
  window.__campaignWizard = this;

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
            <div class="small-muted">Campaign Summary</div>
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
    this.summaryList = this.mount.querySelector("#summaryList");
    this.summaryPane = this.mount.querySelector("#summaryPane");
    this.prevBtn = this.mount.querySelector("#prevBtn");
    this.nextBtn = this.mount.querySelector("#nextBtn");
    this.stepsBar = [...this.mount.querySelectorAll(".step-pill")];
    this.connectors = [...this.mount.querySelectorAll(".step-connector")];
    this.previewPanel = this.mount.querySelector("#tplPreviewPanel");

    this.prevBtn.onclick = () => this.prev();
    this.nextBtn.onclick = () => this.next();

    // ❌ do NOT allow forward skipping at all
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
    const res = await fetch(`${this.apiBase}/templates`);
    const json = await res.json();

    this.state.templates = (json.templates || []).map(t => {
  // 🔒 ENTERPRISE NORMALIZATION
  // Campaign templates describe headers differently than announcements

  let mediaType = null;

  if (t.media_type) {
    mediaType = t.media_type; // image | video | document
  } else if (t.header_type) {
    // backend sometimes sends IMAGE / VIDEO / DOCUMENT
    mediaType = t.header_type.toLowerCase();
  } else if (t.header_required === true) {
    // safest fallback (existing behavior)
    mediaType = "document";
  }

  return {
    ...t,
    id: t.template_id || t.id,
    name: t.display_name || t.name,

    // ✅ CANONICAL MEDIA FIELD (THIS IS KEY)
    _mediaType: mediaType, // null | image | video | document

    has_body_params: t.has_body_params === true,
    body_param_count: Number(t.body_param_count) || 0
  };
});

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

    list.innerHTML = this.state.filteredTemplates.map(t => `
      <div class="tpl-row ${this.state.template?.id === t.id ? "selected" : ""}" data-id="${t.id}">
        ${this.renderMediaThumb(t)}
        <div class="tpl-info">
          <div class="tpl-title">${this.escape(t.name)}</div>
          <span class="tpl-cat">${this.escape(t.category)}</span>
          <div class="tpl-text">${this.escape(t.preview_text)}</div>
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

  // 🔒 GUARANTEE: media step can NEVER be skipped
  selectTemplate(id) {
  this.state.template = this.state.templates.find(t => t.id === id);
  this.state.media = { assetId: null, url: null, type: null };
  this.saveDraft();
  this.hidePreview();

  // 🧠 Campaign body variables (parity with announcements)
  this.state.variables = this.state.template.has_body_params
   ? Array(this.state.template.body_param_count).fill("")
   : [];


  // 🔒 Media step is ALWAYS step 2 (even for text-only)
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
    if (this.state.step !== 1) return;

    this.previewPanel.innerHTML = `
      <div class="preview-header">
        <div class="preview-title">${this.escape(tpl.name)}</div>
        <div class="preview-sub">${this.escape(tpl.category)}</div>
      </div>
      ${this.renderMediaPreview(tpl)}
      <div class="wa-bubble">
        <div class="wa-text">${this.escape(tpl.preview_text)}</div>
      </div>
    `;
    this.previewPanel.classList.remove("hidden");
  }

  getTemplateMediaType(tpl) {
  // 🔒 DO NOT INFER. USE NORMALIZED VALUE.
  return tpl?._mediaType || null;
}



  // ✅ ALWAYS show placeholder if template expects media
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
  const mediaType = this.getTemplateMediaType(this.state.template);

  // 🧠 TEXT-ONLY CAMPAIGN — STILL A MEDIA STEP
  if (!mediaType) {
    this.stepPane.innerHTML = `
      <div class="panel" style="padding:24px; text-align:center;">
        <div style="font-size:18px; font-weight:600; margin-bottom:8px;">
          No media required
        </div>
        <div class="small-muted" style="max-width:420px; margin:0 auto;">
          This campaign template does not include an image, video, or document header.
          You can continue directly to audience selection.
        </div>
        <div style="margin-top:24px;">
          <button class="btn primary" id="continueToAudience">
            Continue
          </button>
        </div>
      </div>
    `;

    this.stepPane.querySelector("#continueToAudience").onclick = () => {
      this.state.step = 3;
      this.saveDraft();
      this.render();
    };

    return;
  }

  // 🧩 MEDIA REQUIRED — LOAD MediaManager
  this.stepPane.innerHTML = `
    <link rel="stylesheet" href="css/media-manager.css">
    <div id="mediaMount"></div>
  `;

  const { MediaManager } = await import("./mediaManager.js");

  this._mediaMgr = new MediaManager({
    mount: this.stepPane.querySelector("#mediaMount"),
    apiBase: this.apiBase,
    scope: "campaign",
    mediaType
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
          <p class="small-muted">
            Expand regions to select schools, classes, or groups.
          </p>
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
                oninput="window.__campaignWizard.updateVar(${i}, this.value)"
              />
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
  `;
}

updateVar(i, v) {
  this.state.variables[i] = v;

  const t = this.state.template;
  if (!t) return;

  const previewHTML = t.preview_text.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const val = this.state.variables[idx - 1];
    return val
      ? `<span class="wa-var">${this.escape(val)}</span>`
      : `<span class="wa-var placeholder">Var ${idx}</span>`;
  });

  const bubble = this.stepPane.querySelector(".wa-text");
  if (bubble) bubble.innerHTML = previewHTML;
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
    
    // Buttons visibility
    if (this.state.step === 2) {
      // MEDIA STEP — controlled internally by MediaManager
      this.prevBtn.style.display = "none";
      this.nextBtn.style.display = "none";
    } else {
      this.prevBtn.style.display = this.state.step === 1 ? "none" : "inline-block";
      this.nextBtn.style.display = this.state.step === 1 ? "none" : "inline-block";
      this.nextBtn.textContent = this.state.step === 4 ? "Send Campaign" : "Next";
      this.nextBtn.disabled = this.state.sending;
    }

    // Summary pane visibility
    if (this.state.step === 2) {
      // ❌ Hide Campaign Summary during Media selection
      this.summaryPane.style.display = "none";
    } else {
      this.summaryPane.style.display = this.state.step === 1 ? "none" : "block";
    }
        

    this.renderSummary();
  }

  renderSummary() {
    this.summaryList.innerHTML = `
      <div class="summary-item"><span>Template</span><strong>${this.state.template?.name || "—"}</strong></div>
      <div class="summary-item"><span>Audience Groups</span><strong>${this.state.audience.selected.length}</strong></div>
      <div class="summary-item"><span>Estimated</span><strong>${this.state.audience.estimated}</strong></div>
    `;
  }

  next() {
    if (this.state.step === 1 && !this.state.template) return alert("Select a template");
    if (this.state.step === 2 && !this.state.media.assetId)
      return alert("Select media to continue");
    if (this.state.step === 3 && !this.state.audience.selected.length)
      return alert("Select at least one audience group");
    if (this.state.step === 4) {
      if (
        this.state.template.has_body_params &&
        this.state.variables.some(v => !v.trim())
      ) {
        return alert("Fill all variables");
      }
      return this.submit();
    }


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

  async submit() {
    if (this.state.sending) return;
    this.state.sending = true;
    this.render();

    await apiFetch(`${this.apiBase}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: this.state.template.id,
        mediaAssetId: this.state.media.assetId || null,
        audienceNodeIds: this.state.audience.selected, // ✅ renamed
        bodyParams: this.state.template.has_body_params
        ? [...this.state.variables]
        : []
      })
    });

    alert("Campaign queued successfully");
    localStorage.removeItem(this.storageKey);
    location.reload();
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