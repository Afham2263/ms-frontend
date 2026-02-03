// // js/components/templates.js
// // Template Selector Engine — pure modular vanilla JS
// export class Templates {
//   constructor({ mount, apiBase = "/api", cacheTTL = 1000 * 60 * 5 }) {
//     if (!mount) throw new Error("Templates requires mount element");
//     this.mount = mount;
//     this.apiBase = apiBase;
//     this.cacheTTL = cacheTTL;
//     this.state = { templates: [], selected: null, loading: true, error: null };
//     this.localCacheKey = "ms_templates_cache_v1";
//   }

//   async init() {
//     this.mount.classList.add("templates-wrapper");
//     this.mount.innerHTML = this.template(); // skeleton UI
//     this.bindElements();
//     await this.loadTemplates();
//     this.renderGrid();
//     this.renderPreview();
//   }

//   template() {
//     return `
//       <link rel="stylesheet" href="css/templates.css">
//       <div class="templates-wrap">
//         <div class="templates-grid" id="tplGrid">
//           <!-- cards -->
//         </div>
//         <aside class="tpl-preview" id="tplPreview">
//           <div class="preview-header">
//             <div>
//               <div class="preview-title" id="previewTitle">Select a template</div>
//               <div class="preview-sub" id="previewSub">Choose a Meta-approved template to preview</div>
//             </div>
//             <div><button id="refreshTemplates" class="btn">Refresh</button></div>
//           </div>

//           <div id="previewContent">
//             <div class="whatsapp-mock" id="whatsappMock">
//               <div style="color:#0b1c32;font-weight:600">No template selected</div>
//             </div>
//             <div id="mediaBlock" class="media-block"></div>

//             <div class="preview-vars" id="previewVars"></div>

//             <div style="display:flex;gap:8px;align-items:center;">
//               <button id="chooseBtn" class="btn-choose" disabled>Choose Template</button>
//               <div id="templateStatus" class="preview-sub"></div>
//             </div>
//           </div>
//         </aside>
//       </div>
//     `;
//   }

//   bindElements() {
//     this.gridEl = this.mount.querySelector("#tplGrid");
//     this.previewTitle = this.mount.querySelector("#previewTitle");
//     this.previewSub = this.mount.querySelector("#previewSub");
//     this.previewContent = this.mount.querySelector("#previewContent");
//     this.mediaBlock = this.mount.querySelector("#mediaBlock");
//     this.previewVars = this.mount.querySelector("#previewVars");
//     this.chooseBtn = this.mount.querySelector("#chooseBtn");
//     this.refreshBtn = this.mount.querySelector("#refreshTemplates");

//     this.chooseBtn.addEventListener("click", () => this.chooseTemplate());
//     this.refreshBtn.addEventListener("click", () => this.loadTemplates(true));
//   }

//   async loadTemplates(force = false) {
//     this.setState({ loading: true, error: null });
//     // check cache first
//     try {
//       const cached = JSON.parse(localStorage.getItem(this.localCacheKey) || "null");
//       const now = Date.now();
//       if (!force && cached && (now - cached.ts < this.cacheTTL)) {
//         this.setState({ templates: cached.data, loading: false });
//         return;
//       }
//     } catch (e) {
//       // ignore cache parse errors
//     }

//     try {
//       const res = await fetch(`${this.apiBase}/templates`, { cache: "no-store" });
//       if (!res.ok) throw new Error("Failed to fetch templates");
//       const json = await res.json();
//       const templates = json.templates || [];
//       // Save cache
//       localStorage.setItem(this.localCacheKey, JSON.stringify({ ts: Date.now(), data: templates }));
//       this.setState({ templates, loading: false });
//     } catch (err) {
//       console.error("Templates load error", err);
//       this.setState({ error: err.message || String(err), loading: false });
//       // fallback to cache if exists
//       const cached = JSON.parse(localStorage.getItem(this.localCacheKey) || "null");
//       if (cached && cached.data) {
//         this.setState({ templates: cached.data, loading: false });
//       }
//     }
//   }

//   setState(patch) {
//     this.state = { ...this.state, ...patch };
//   }

//   renderGrid() {
//     const { templates, loading } = this.state;
//     this.gridEl.innerHTML = "";

//     if (loading) {
//       for (let i = 0; i < 6; i++) {
//         const s = document.createElement("div");
//         s.className = "tpl-skeleton";
//         this.gridEl.appendChild(s);
//       }
//       return;
//     }

//     if (!templates || templates.length === 0) {
//       this.gridEl.innerHTML = `<div class="placeholder">No templates available.</div>`;
//       return;
//     }

//     templates.forEach(t => {
//       const card = document.createElement("div");
//       card.className = "tpl-card";
//       if (!t.approved) card.classList.add("tpl-lock");

//       card.setAttribute("tabindex", "0");
//       card.dataset.id = t.id;

//       const thumbUrl = (t.media && (t.media.thumb || t.media.url)) || "";
//       const thumb = document.createElement("img");
//       thumb.className = "tpl-thumb";
//       thumb.alt = t.name;
//       if (thumbUrl) thumb.src = thumbUrl;
//       else thumb.style.background = "#eef2f6";

//       const meta = document.createElement("div");
//       meta.className = "tpl-meta";
//       meta.innerHTML = `<div class="tpl-name">${this.escape(t.name)}</div>
//                         <div class="tpl-cat">${this.escape(t.category || "general")}</div>`;

//       card.appendChild(thumb);
//       card.appendChild(meta);

//       card.addEventListener("click", () => this.selectTemplate(t.id));
//       card.addEventListener("keydown", (e) => { if (e.key === "Enter") this.selectTemplate(t.id); });

//       this.gridEl.appendChild(card);
//     });
//   }

//   selectTemplate(id) {
//     const tpl = this.state.templates.find(t => t.id === id);
//     if (!tpl) return;
//     this.setState({ selected: tpl });
//     this.renderPreview();
//     // highlight card (simple)
//     this.gridEl.querySelectorAll(".tpl-card").forEach(c => c.classList.toggle("active", c.dataset.id === id));
//   }

//   renderPreview() {
//     const { selected } = this.state;
//     if (!selected) {
//       this.previewTitle.textContent = "Select a template";
//       this.previewSub.textContent = "Choose a Meta-approved template to preview";
//       this.previewVars.innerHTML = "";
//       this.mediaBlock.innerHTML = "";
//       this.previewContent.querySelector("#whatsappMock").innerHTML = `<div style="color:#0b1c32;font-weight:600">No template selected</div>`;
//       this.chooseBtn.disabled = true;
//       this.mount.querySelector("#templateStatus").textContent = "";
//       return;
//     }

//     this.previewTitle.textContent = selected.name;
//     this.previewSub.textContent = `Category: ${selected.category || "general"} • Updated: ${new Date(selected.lastUpdated || Date.now()).toLocaleString()}`;

//     // WhatsApp-style text preview
//     const text = this.buildPreviewText(selected);
//     const mock = this.previewContent.querySelector("#whatsappMock");
//     mock.innerHTML = `<div style="white-space:pre-wrap">${this.escape(text)}</div>`;

//     // media
//     this.mediaBlock.innerHTML = "";
//     if (selected.media && selected.media.type) {
//       const m = selected.media;
//       if (m.type === "image") {
//         const img = document.createElement("img");
//         img.src = m.url; img.alt = selected.name;
//         this.mediaBlock.appendChild(img);
//       } else if (m.type === "video") {
//         const vid = document.createElement("video");
//         vid.controls = true; vid.src = m.url; vid.preload = "metadata";
//         this.mediaBlock.appendChild(vid);
//       } else {
//         // document
//         const doc = document.createElement("div");
//         doc.innerHTML = `<a target="_blank" rel="noopener noreferrer" href="${this.escapeAttr(m.url)}">${this.escape(m.filename || m.url)}</a>`;
//         this.mediaBlock.appendChild(doc);
//       }
//     }

//     // variable inputs preview (non-editable here, but show fields)
//     this.previewVars.innerHTML = "";
//     (selected.variables || []).forEach((v, i) => {
//       const row = document.createElement("div");
//       row.innerHTML = `<label style="font-size:13px;color:#374151">${this.escape(v)}: <strong style="margin-left:8px;color:#0b1740">{{${i+1}}}</strong></label>`;
//       this.previewVars.appendChild(row);
//     });

//     // status & choose
//     this.chooseBtn.disabled = !selected.approved;
//     this.mount.querySelector("#templateStatus").textContent = selected.approved ? "Approved by Meta" : "Not approved";

//     // accessibility focus
//     this.chooseBtn.focus();
//   }

//   buildPreviewText(tpl) {
//     // show preview of template placeholders
//     let text = tpl.preview_text || "";
//     // substitute placeholders with sample values (non-destructive)
//     (tpl.variables || []).forEach((v, i) => {
//       const token = new RegExp(`\\{\\{\\s*${i+1}\\s*\\}\\}|\\{\\{\\s*${v}\\s*\\}\\}`, "g");
//       text = text.replace(token, `[${v}]`);
//     });
//     return text;
//   }

//   chooseTemplate() {
//     const selected = this.state.selected;
//     if (!selected) return;
//     if (!selected.approved) {
//       alert("This template is not approved by Meta and cannot be used.");
//       return;
//     }
//     // Emit a CustomEvent so other modules can pick it up
//     const ev = new CustomEvent("template:selected", { detail: { template: selected } });
//     window.dispatchEvent(ev);

//     // Provide visual confirmation
//     this.mount.querySelector("#templateStatus").textContent = "Template selected. Proceed to Campaign Wizard.";
//   }

//   escape(s) {
//     if (s == null) return "";
//     return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
//   }

//   escapeAttr(s) {
//     if (s == null) return "";
//     return encodeURI(s);
//   }
// }
