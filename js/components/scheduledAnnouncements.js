// js/components/scheduledAnnouncements.js
import { AnnouncementPreviewDrawer } from "./announcementPreviewDrawer.js";
import { apiFetch } from "../apiFetch.js";


export class ScheduledAnnouncements {
  constructor({ mount, apiBase = "/api" }) {
    this.mount = mount;
    this.apiBase = apiBase;

    this.all = [];
    this.selected = new Set();
    this._expanded = false;
    this._drawer = null;

  }

  async init() {
    this.cache();
    await this.load();
    this.bind();
    this.render();

    // 🔒 Drawer is single-instance, created once
    this._drawer = new AnnouncementPreviewDrawer({
      apiBase: this.apiBase
    });


  }

  cache() {
    this.listEl = this.mount.querySelector("#scheduledList");
    this.searchEl = this.mount.querySelector("#scheduledSearch");
    this.selectAllEl = this.mount.querySelector("#selectAllScheduled");
    this.bulkDeleteBtn = this.mount.querySelector("#bulkDeleteScheduled");
    this.viewAllBtn = this.mount.querySelector("#viewAllScheduled");

      // 🔄 NEW
  this.refreshBtn = this.mount.querySelector("#refreshScheduled");
  }

  async load() {
    const res = await apiFetch(`${this.apiBase}/announcements/scheduled`);
    const json = await res.json();

    this.all = json
      .filter(a => ["SCHEDULED", "SENDING"].includes(a.status))
      .map(a => ({
        id: a.id,
        templateName: a.template_display_name || "—",
        scheduled_at: a.scheduled_at,
        status: a.status
      }))
      .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
  }

  bind() {

      // 🔄 Manual refresh
  if (this.refreshBtn) {
    this.refreshBtn.onclick = async () => {
      this.refreshBtn.disabled = true;
      this.refreshBtn.classList.add("spinning");

      await this.load();
      this.render();

      this.refreshBtn.classList.remove("spinning");
      this.refreshBtn.disabled = false;
    };
  }

  // existing bindings below ↓↓↓

    
    this.searchEl.oninput = () => this.render();

    this.selectAllEl.onchange = e => {
      this.selected.clear();
      if (e.target.checked) {
        this.filtered().forEach(a => this.selected.add(a.id));
      }
      this.render();
    };

    this.bulkDeleteBtn.onclick = () => {
  if (!this.selected.size) return;

  const ids = [...this.selected];

  const ok = confirm(
    `Delete ${ids.length} scheduled announcement(s)? This cannot be undone.`
  );
  if (!ok) return;

  if (ids.length === 1) {
    this.deleteAnnouncement(ids[0]);
  } else {
    this.bulkDeleteAnnouncements(ids);
  }
};


    this.viewAllBtn.onclick = () => {
      this._expanded = !this._expanded;
      this.viewAllBtn.textContent = this._expanded
        ? "Show less"
        : "View all scheduled announcements";
      this.render();
    };

    this.listEl.addEventListener("click", e => {
      const menu = e.target.closest(".scheduled-menu");
      if (menu) {
        e.stopPropagation();
        const row = menu.closest(".scheduled-row");
        this.menu(row.dataset.id);
        return;
      }

      const checkbox = e.target.closest("input[type='checkbox']");
      if (checkbox) {
        e.stopPropagation();
        const row = checkbox.closest(".scheduled-row");
        this.toggle(row.dataset.id, checkbox.checked);
        return;
      }

      const row = e.target.closest(".scheduled-row");
      if (!row) return;

      this.openDrawer(row.dataset.id);
    });
  }

  filtered() {
    const q = this.searchEl.value.toLowerCase();
    return this.all.filter(a =>
      (a.templateName || "").toLowerCase().includes(q)
    );
  }

  render() {
    const rows = this._expanded
      ? this.filtered()
      : this.filtered().slice(0, 2);

    this.bulkDeleteBtn.classList.toggle(
      "hidden",
      this.selected.size === 0
    );

    this.listEl.innerHTML = rows.map(a => this.row(a)).join("");
    this.syncSelectAllCheckbox();

  }

  row(a) {
  const date = new Date(a.scheduled_at);
  const dateStr = date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  return `
    <div class="scheduled-row ${this.selected.has(a.id) ? "selected" : ""}" data-id="${a.id}">

      <div class="cell checkbox">
        <input type="checkbox" ${this.selected.has(a.id) ? "checked" : ""} />
      </div>

      <div class="cell main horizontal">
        <span class="scheduled-title">${this.escape(a.templateName)}</span>
        <span class="separator">•</span>
        <span class="scheduled-date">${dateStr}</span>
        <span class="separator">•</span>
        <span class="scheduled-time">${timeStr}</span>
      </div>

      <div class="cell status">
        <span class="status-pill scheduled">Scheduled</span>
      </div>

      <div class="cell menu">
        <button type="button">⋮</button>
      </div>
    </div>
  `;
}


  toggle(id, on) {
    on ? this.selected.add(id) : this.selected.delete(id);
    this.render();
  }

  openDrawer(id) {
    this._drawer.open(id);
  }

  menu(id) {
    const ann = this.all.find(a => a.id === id);
    if (!ann) return;

    if (ann.status !== "SCHEDULED") {
      alert("Only scheduled announcements can be edited or deleted.");
      return;
    }

    this.showDeleteConfirm(ann);
  }


   
  syncSelectAllCheckbox() {
  const visibleIds = this.filtered().map(a => a.id);

  if (!visibleIds.length) {
    this.selectAllEl.checked = false;
    this.selectAllEl.indeterminate = false;
    return;
  }

  const selectedCount = visibleIds.filter(id =>
    this.selected.has(id)
  ).length;

  this.selectAllEl.checked =
    selectedCount === visibleIds.length;

  this.selectAllEl.indeterminate =
    selectedCount > 0 && selectedCount < visibleIds.length;
}

  async bulkDeleteAnnouncements(ids) {
  try {
    const res = await apiFetch(
      `${this.apiBase}/announcements/bulk-delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcementIds: ids
        })
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.detail || "Bulk delete failed");
      return;
    }

    const json = await res.json();

    // ✅ Backend is authoritative
    const deletedSet = new Set(json.announcement_ids);

    // 🔄 Update UI state
    this.all = this.all.filter(a => !deletedSet.has(a.id));
    this.selected.clear();

    this.render();

  } catch (err) {
    console.error(err);
    alert("Bulk delete failed");
  }
}



  



  
  showDeleteConfirm(ann) {
    document.querySelector(".delete-popover")?.remove();

    const row = this.listEl.querySelector(
      `.scheduled-row[data-id="${ann.id}"]`
    );
    if (!row) return;

    const pop = document.createElement("div");
    pop.className = "delete-popover";
    pop.innerHTML = `
      <div class="delete-popover-inner">
        <div class="delete-title">
          Delete "${this.escape(ann.templateName)}"?
        </div>
        <div class="delete-actions">
          <button class="btn ghost" data-action="cancel">Cancel</button>
          <button class="btn danger" data-action="delete">Delete</button>
        </div>
      </div>
    `;

    row.appendChild(pop);

    pop.onclick = e => {
      e.stopPropagation();
      const action = e.target.dataset.action;
      if (action === "cancel") pop.remove();
      if (action === "delete") {
        pop.remove();
        this.deleteAnnouncement(ann.id);
      }
    };

    setTimeout(() => {
      document.addEventListener("click", () => pop.remove(), { once: true });
    }, 0);
  }

  async deleteAnnouncement(id) {
    try {
      const res = await apiFetch(
        `${this.apiBase}/announcements/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");

      this.all = this.all.filter(a => a.id !== id);
      this.selected.delete(id);
      this.render();
    } catch {
      alert("Failed to delete announcement");
    }
  }

  // js/components/scheduledAnnouncements.js
destroy() {
  this._drawer?.close();
  this._drawer = null;
}



  escape(s) {
    return String(s || "").replace(/[&<>"']/g, c =>
      ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
    );
  }
}
