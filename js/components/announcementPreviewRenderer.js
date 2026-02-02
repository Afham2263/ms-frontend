// js/components/announcementPreviewRenderer.js
// ENTERPRISE — Shared, Read-Only Preview Renderer

export function renderAnnouncementPreview(container, data) {
  const {
    template_name,
    body_text,
    body_params = [],
    media,
  } = data;

  const previewHTML = body_text.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const val = body_params[idx - 1];
    return val
      ? `<span class="wa-var">${escape(val)}</span>`
      : `<span class="wa-var placeholder">Var ${idx}</span>`;
  });

  container.innerHTML = `
    <div class="preview-disclaimer">
      <span class="info-dot">i</span>
      <span>
        This is a read-only preview of the scheduled announcement.
      </span>
    </div>

    <div class="review-layout">
      <div class="review-preview">
        ${renderMedia(media)}
        <div class="wa-bubble large">
          <div class="wa-text">${previewHTML}</div>
        </div>
      </div>
    </div>
  `;
}

function renderMedia(media) {
  if (!media || !media.url) return "";

  if (media.type === "image") {
    return `
      <div class="review-media">
        <img src="${media.url}" alt="Preview image" />
      </div>
    `;
  }

  if (media.type === "video") {
    return `
      <div class="review-media">
        <video
          src="${media.url}"
          controls
          preload="metadata"
          style="max-width:100%; border-radius:12px;"
        ></video>
      </div>
    `;
  }

  if (media.type === "document") {
    return `
      <div class="review-media doc">
        <a href="${media.url}" target="_blank" rel="noopener">
          📄 View document
        </a>
      </div>
    `;
  }

  return "";
}

function escape(s) {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
  );
}
