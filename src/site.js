(function initializeSiteApi(root) {
  "use strict";

  function normalizeBaseUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value.trim())
      ? value.trim()
      : `https://${value.trim()}`;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) return "";
      return parsed.origin;
    } catch {
      return "";
    }
  }

  function originPattern(value) {
    const baseUrl = normalizeBaseUrl(value);
    return baseUrl ? `${baseUrl}/*` : "";
  }

  const api = Object.freeze({ normalizeBaseUrl, originPattern });
  root.OpenCanvasSite = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
