(function initializeSettingsTransfer(root) {
  "use strict";

  const FORMAT = "opencanvas-settings";
  const VERSION = 1;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const paletteApi = root.CanvasPalette
    || (typeof module !== "undefined" && module.exports ? require("./palette.js") : null);
  const siteApi = root.OpenCanvasSite
    || (typeof module !== "undefined" && module.exports ? require("./site.js") : null);
  const cardImagesApi = root.OpenCanvasCardImages
    || (typeof module !== "undefined" && module.exports ? require("./card-images.js") : null);

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function invalidFile(message) {
    return new Error(`Invalid OpenCanvas settings file: ${message}`);
  }

  function validateSettings(candidate) {
    if (!isRecord(candidate)) throw invalidFile("settings are missing.");
    if (typeof candidate.enabled !== "boolean") throw invalidFile("enabled must be true or false.");
    if (candidate.selectedPalette !== "custom"
      && !Object.prototype.hasOwnProperty.call(paletteApi.PRESET_PALETTES, candidate.selectedPalette)) {
      throw invalidFile("the selected palette is not supported.");
    }
    if (!isRecord(candidate.customPalette)
      || paletteApi.COLOR_KEYS.some((key) => !paletteApi.isHexColor(candidate.customPalette[key]))) {
      throw invalidFile("the custom palette is incomplete.");
    }
    if (typeof candidate.schoolBaseUrl !== "string") {
      throw invalidFile("the Canvas site URL must be text.");
    }
    const schoolBaseUrl = candidate.schoolBaseUrl
      ? siteApi.normalizeBaseUrl(candidate.schoolBaseUrl)
      : "";
    if (candidate.schoolBaseUrl && !schoolBaseUrl) {
      throw invalidFile("the Canvas site URL is not a valid HTTPS URL.");
    }
    return paletteApi.normalizeSettings({ ...candidate, schoolBaseUrl });
  }

  function normalizeOrigin(value) {
    if (typeof value !== "string") return "";
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) return "";
      return url.origin;
    } catch {
      return "";
    }
  }

  function normalizeCardImages(candidate, strict = false) {
    if (!isRecord(candidate)) {
      if (strict) throw invalidFile("images must be grouped by Canvas site.");
      return {};
    }

    const normalized = {};
    Object.entries(candidate).forEach(([origin, courses]) => {
      const normalizedOrigin = normalizeOrigin(origin);
      if (!normalizedOrigin || !isRecord(courses)) {
        if (strict) throw invalidFile(`the image group for ${origin} is invalid.`);
        return;
      }

      const normalizedCourses = {};
      Object.entries(courses).forEach(([courseId, source]) => {
        const normalizedSource = cardImagesApi.normalizeImageSource(source);
        if (!/^\d+$/.test(courseId) || !normalizedSource) {
          if (strict) throw invalidFile(`the image for course ${courseId} is invalid.`);
          return;
        }
        normalizedCourses[courseId] = normalizedSource;
      });
      if (Object.keys(normalizedCourses).length > 0) normalized[normalizedOrigin] = normalizedCourses;
    });
    return normalized;
  }

  function createSettingsFile(settings, cardImages) {
    return {
      format: FORMAT,
      version: VERSION,
      settings: paletteApi.normalizeSettings(settings),
      images: normalizeCardImages(cardImages)
    };
  }

  function serializeSettingsFile(settings, cardImages) {
    return `${JSON.stringify(createSettingsFile(settings, cardImages), null, 2)}\n`;
  }

  function parseSettingsFile(text) {
    if (typeof text !== "string") throw invalidFile("file contents must be text.");
    let candidate;
    try {
      candidate = JSON.parse(text);
    } catch {
      throw invalidFile("the file is not valid JSON.");
    }
    if (!isRecord(candidate) || candidate.format !== FORMAT) {
      throw invalidFile("the file type is not recognized.");
    }
    if (candidate.version !== VERSION) {
      throw invalidFile(`version ${String(candidate.version)} is not supported.`);
    }
    return {
      settings: validateSettings(candidate.settings),
      images: normalizeCardImages(candidate.images, true)
    };
  }

  const api = Object.freeze({
    FORMAT,
    VERSION,
    MAX_FILE_BYTES,
    createSettingsFile,
    serializeSettingsFile,
    parseSettingsFile,
    normalizeCardImages
  });

  root.OpenCanvasSettingsTransfer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
