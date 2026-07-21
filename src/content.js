(function initializeCanvasTheme() {
  "use strict";

  const paletteApi = globalThis.CanvasPalette;
  const root = document.documentElement;
  const variableNames = Object.keys(paletteApi.paletteToVariables(paletteApi.DARK_PALETTE));
  const colorRepair = globalThis.CanvasInlineColorRepair.create({
    document,
    getComputedStyle: globalThis.getComputedStyle,
    MutationObserver: globalThis.MutationObserver
  });

  function applySettings(candidate) {
    const settings = paletteApi.normalizeSettings(candidate);

    if (!settings.enabled) {
      colorRepair.applyTheme(null);
      delete root.dataset.canvasTheme;
      variableNames.forEach((name) => root.style.removeProperty(name));
      return;
    }

    const palette = paletteApi.resolvePalette(settings);
    const variables = paletteApi.paletteToVariables(palette);
    Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
    root.dataset.canvasTheme = "dark";
    colorRepair.applyTheme({ text: palette.text, background: palette.background });
  }

  // Apply the default synchronously to avoid a light flash before sync storage responds.
  applySettings(paletteApi.DEFAULT_SETTINGS);
  chrome.storage.sync.get(paletteApi.DEFAULT_SETTINGS, (stored) => {
    if (!chrome.runtime.lastError) applySettings(stored);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    chrome.storage.sync.get(paletteApi.DEFAULT_SETTINGS, (stored) => {
      if (!chrome.runtime.lastError) applySettings(stored);
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "canvas-palette:get-status") {
      sendResponse({ available: true, active: root.dataset.canvasTheme === "dark" });
    }
  });
})();
