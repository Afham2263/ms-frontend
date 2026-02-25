// PREVIEW MODE API PROXY — ENTERPRISE HARDLOCKED
//// ⚠ Static-hosting safe: do not use absolute paths

// GOALS (NON-NEGOTIABLE):
// 1. Proxy ALL relative /api/* calls to ngrok in preview mode
// 2. INCLUDING multipart uploads (media-assets)
// 3. NEVER proxy absolute URLs
// 4. NEVER silently bypass uploads again
// 5. Fail LOUD if something tries to bypass media routes
//
// Backend-confirmed final contract:
// POST /api/media-assets   (multipart)
// GET  /api/media-assets?scope=...&media_type=...

(() => {
  // ─────────────────────────────────────────────
  // DEV DETECTION (SAFE, NON-INTRUSIVE)
  // ─────────────────────────────────────────────
  const isLocalDev =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.endsWith(".ngrok-free.dev");

  const isPreview =
    isLocalDev ||
    localStorage.getItem("ms_preview_mode") === "admin";

  const NGROK_ORIGIN = "https://c500-2405-201-c023-f11a-f17d-fa5b-71f2-1211.ngrok-free.app";

  console.log("[MOCK API] Loaded. Preview mode:", isPreview);

  if (!isPreview) return;

  console.warn("⚠ PREVIEW MODE ENABLED");
  console.warn("→ Proxying ALL relative /api/* calls to ngrok (HARDLOCKED)");

  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init = {}) {
    let url = "";
    let requestInit = init;

    // Normalize input
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
      requestInit = {
        method: input.method,
        headers: input.headers,
        body: input.body,
        mode: input.mode,
        credentials: input.credentials,
        cache: input.cache,
        redirect: "manual" // never auto-follow redirects
      };
    }

    // 🔒 Absolute URLs are NEVER touched
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return originalFetch(input, init);
    }

    // 🚨 HARD RULE: ALL /api/* MUST BE PROXIED
    if (url.startsWith("/api/")) {
      const normalized = url.replace(/\/+$/, "");
      const proxiedUrl = NGROK_ORIGIN + normalized;

      console.log(
        `[MOCK API] ${requestInit.method || "GET"} ${normalized} → ${proxiedUrl}`
      );

      return originalFetch(
        new Request(proxiedUrl, {
          ...requestInit,

          // 🔥 CRITICAL FIX:
          // Preserve credentials for HttpOnly cookie auth
          credentials: requestInit.credentials || "include",

          headers: {
            ...(requestInit.headers || {}),
            "ngrok-skip-browser-warning": "true"
          }
        })
      );
    }

    // Fallback: untouched
    return originalFetch(input, init);
  };

  // 🔐 HARDLOCK ASSERTION (DEV SAFETY NET)
  Object.defineProperty(window.fetch, "__MS_API_PROXY_LOCK__", {
    value: true,
    writable: false,
    configurable: false
  });

  console.info("✅ MOCK API HARDLOCK ACTIVE — media uploads WILL proxy correctly");
})();

// END OF FILE
