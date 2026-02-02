// js/components/audienceTree.js
// ENTERPRISE-GRADE AUDIENCE TREE (REAL TRI-STATE LOGIC)

export class AudienceTree {
  constructor({ mount, apiBase = "/api", collapsedDepth = 1 } = {}) {
    if (!mount) throw new Error("AudienceTree requires a mount element");

    this.mount = mount;
    this.apiBase = apiBase;
    this.collapsedDepth = collapsedDepth;

    // 🔑 real source of truth
    this.nodes = new Map(); // id -> node
    this.root = null;
  }

  async init() {
    this.mount.innerHTML = this.renderSkeleton();

    try {
      const res = await fetch(`${this.apiBase}/audience-groups`, {
        headers: { Accept: "application/json" }
      });
      if (!res.ok) throw new Error("Audience API failed");

      const data = await res.json();
      this.root = this.buildTree(data, null);

      this.mount.innerHTML = `<div class="audience-tree"></div>`;
      this.treeEl = this.mount.querySelector(".audience-tree");

      this.renderNode(this.root, this.treeEl, 0);
      this.emitSelection();
    } catch (e) {
      console.error(e);
      this.mount.innerHTML =
        `<div class="small-muted">Failed to load audience groups.</div>`;
    }
  }

  /* ───────── TREE MODEL ───────── */

  buildTree(raw, parent) {
    const node = {
      id: raw.id,
      name: raw.name,
      count: raw.count ?? 0,
      parent,
      children: [],
      checked: false,
      indeterminate: false,
      el: null,
      checkbox: null
    };

    this.nodes.set(node.id, node);

    if (Array.isArray(raw.children)) {
      node.children = raw.children.map(c =>
        this.buildTree(c, node)
      );
    }

    return node;
  }

  /* ───────── RENDER ───────── */

  renderNode(node, container, depth) {
    const hasChildren = node.children.length > 0;

    const row = document.createElement("div");
    row.className = "aud-node";
    if (depth === 0) row.classList.add("aud-root");
    row.style.paddingLeft = `${depth * 18}px`;

    const toggler = document.createElement("button");
    toggler.className = "aud-toggler";
    toggler.textContent = hasChildren
      ? depth <= this.collapsedDepth ? "▾" : "▸"
      : "•";

    if (!hasChildren) toggler.classList.add("aud-toggler-leaf");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "aud-checkbox";

    const label = document.createElement("label");
    label.className = "aud-label";
    label.innerHTML = `
      <span class="aud-name ${hasChildren ? "parent" : "leaf"}">
        ${this.escape(node.name)}
      </span>
      <span class="aud-meta">${node.count} recipients</span>
    `;

    row.append(toggler, checkbox, label);
    container.appendChild(row);

    node.el = row;
    node.checkbox = checkbox;

    let childrenEl = null;

    if (hasChildren) {
      childrenEl = document.createElement("div");
      childrenEl.className = "aud-children";
      childrenEl.style.display =
        depth <= this.collapsedDepth ? "block" : "none";

      container.appendChild(childrenEl);

      toggler.onclick = () => {
        const open = childrenEl.style.display === "block";
        childrenEl.style.display = open ? "none" : "block";
        toggler.textContent = open ? "▸" : "▾";
      };

      node.children.forEach(child =>
        this.renderNode(child, childrenEl, depth + 1)
      );
    }

    checkbox.onchange = () => {
      this.setChecked(node, checkbox.checked);
      this.updateAncestors(node.parent);
      this.updateCheckboxes();
      this.emitSelection();
    };
  }

  /* ───────── STATE LOGIC (REAL) ───────── */

  setChecked(node, checked) {
    node.checked = checked;
    node.indeterminate = false;

    node.children.forEach(c => this.setChecked(c, checked));
  }

  updateAncestors(node) {
    if (!node) return;

    const total = node.children.length;
    const checked = node.children.filter(c => c.checked).length;
    const indet = node.children.filter(c => c.indeterminate).length;

    if (checked === total) {
      node.checked = true;
      node.indeterminate = false;
    } else if (checked === 0 && indet === 0) {
      node.checked = false;
      node.indeterminate = false;
    } else {
      node.checked = false;
      node.indeterminate = true;
    }

    this.updateAncestors(node.parent);
  }

  updateCheckboxes() {
    this.nodes.forEach(node => {
      if (!node.checkbox) return;
      node.checkbox.checked = node.checked;
      node.checkbox.indeterminate = node.indeterminate;
    });
  }

  /* ───────── EVENTS ───────── */

  emitSelection() {
    let selected = [];
    let estimated = 0;

    this.nodes.forEach(node => {
      if (node.checked && node.children.length === 0) {
        selected.push(node.id);
        estimated += node.count;
      }
    });

    window.dispatchEvent(
      new CustomEvent("audience:selected", {
        detail: { selected, estimated }
      })
    );
  }

  /* ───────── UTIL ───────── */

  renderSkeleton() {
    return `
      <div class="audience-skeleton">
        <div class="s-line"></div>
        <div class="s-line short"></div>
        <div class="s-line"></div>
      </div>
    `;
  }

  escape(s) {
    return String(s || "").replace(/[&<>"']/g, c =>
      ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
    );
  }
}
