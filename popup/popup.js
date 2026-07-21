(function initializePopup() {
  "use strict";

  const api = globalThis.CanvasPalette;
  const labels = {
    background: "Page",
    surface: "Surface",
    surfaceRaised: "Raised",
    text: "Text",
    muted: "Muted text",
    border: "Border",
    accent: "Accent"
  };

  const enabledInput = document.querySelector("#enabled");
  const paletteSelect = document.querySelector("#palette-select");
  const colorGrid = document.querySelector("#color-grid");
  const statusDot = document.querySelector("#status-dot");
  const statusText = document.querySelector("#status-text");
  const contrastText = document.querySelector("#contrast");
  const preview = document.querySelector("#preview");
  const resetButton = document.querySelector("#reset");
  const customSection = document.querySelector("#custom-section");
  const storageError = document.querySelector("#storage-error");
  let settings = api.normalizeSettings(api.DEFAULT_SETTINGS);
  let persistedSettings = settings;
  let tabStatus = "checking";

  function save(changes) {
    const previousSettings = persistedSettings;
    const proposedSettings = api.normalizeSettings({ ...settings, ...changes });
    settings = proposedSettings;
    render();
    chrome.storage.sync.set(changes, () => {
      if (chrome.runtime.lastError) {
        settings = previousSettings;
        render();
        showStorageError("Could not save theme settings. Please try again.");
        return;
      }
      persistedSettings = proposedSettings;
      clearStorageError();
      refreshActiveTabStatus();
    });
  }

  function showStorageError(message) {
    storageError.textContent = message;
    storageError.hidden = false;
  }

  function clearStorageError() {
    storageError.textContent = "";
    storageError.hidden = true;
  }

  function createColorControls() {
    api.COLOR_KEYS.forEach((key) => {
      const label = document.createElement("label");
      label.className = "color-control";
      label.innerHTML = `
        <input type="color" data-color-key="${key}" aria-label="${labels[key]}">
        <span class="color-copy">
          <span>${labels[key]}</span>
          <span class="color-value"></span>
        </span>`;
      colorGrid.append(label);
    });
  }

  function renderPreview(palette) {
    const names = {
      background: "--preview-background",
      surface: "--preview-surface",
      surfaceRaised: "--preview-raised",
      text: "--preview-text",
      muted: "--preview-muted",
      border: "--preview-border",
      accent: "--preview-accent"
    };
    Object.entries(names).forEach(([key, name]) => preview.style.setProperty(name, palette[key]));
    preview.style.setProperty("--preview-accent-text", api.paletteToVariables(palette)["--ct-accent-text"]);
  }

  function renderContrast(palette) {
    const audit = api.auditPalette(palette);
    const failures = audit.filter((check) => !check.passes);
    contrastText.textContent = failures.length === 0
      ? `All ${audit.length} contrast checks pass`
      : `${audit.length - failures.length}/${audit.length} contrast checks pass · Review ${failures.slice(0, 2).map((check) => check.label).join(" and ")}`;
    contrastText.title = failures.map((check) => `${check.label}: ${check.ratio.toFixed(1)}:1`).join("; ");
    contrastText.classList.toggle("warning", failures.length > 0);
  }

  function renderStatus() {
    const messages = {
      active: "Active on this Canvas tab",
      paused: "Theme paused on this Canvas tab",
      unavailable: "Unavailable on this tab",
      checking: "Checking active tab"
    };
    statusDot.classList.toggle("active", tabStatus === "active");
    statusText.textContent = messages[tabStatus];
  }

  function refreshActiveTabStatus() {
    tabStatus = "checking";
    renderStatus();
    if (!chrome.tabs) {
      tabStatus = "unavailable";
      renderStatus();
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs[0]) {
        tabStatus = "unavailable";
        renderStatus();
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: "canvas-palette:get-status" }, { frameId: 0 }, (response) => {
        if (chrome.runtime.lastError || !response || !response.available) tabStatus = "unavailable";
        else tabStatus = response.active ? "active" : "paused";
        renderStatus();
      });
    });
  }

  function render() {
    const palette = api.resolvePalette(settings);
    enabledInput.checked = settings.enabled;
    paletteSelect.value = settings.selectedPalette;
    customSection.hidden = settings.selectedPalette !== "custom";

    colorGrid.querySelectorAll("[data-color-key]").forEach((input) => {
      const key = input.dataset.colorKey;
      input.value = settings.customPalette[key];
      input.closest("label").querySelector(".color-value").textContent = settings.customPalette[key];
    });

    renderPreview(palette);
    renderContrast(palette);
    renderStatus();
  }

  enabledInput.addEventListener("change", () => save({ enabled: enabledInput.checked }));

  paletteSelect.addEventListener("change", () => {
    save({ selectedPalette: paletteSelect.value });
  });

  colorGrid.addEventListener("input", (event) => {
    const input = event.target.closest("[data-color-key]");
    if (!input) return;
    const customPalette = { ...settings.customPalette, [input.dataset.colorKey]: input.value };
    settings = api.normalizeSettings({ ...settings, customPalette, selectedPalette: "custom" });
    render();
  });

  colorGrid.addEventListener("change", (event) => {
    const input = event.target.closest("[data-color-key]");
    if (!input) return;
    save({ customPalette: settings.customPalette, selectedPalette: "custom" });
  });

  resetButton.addEventListener("click", () => {
    save({ customPalette: { ...api.DARK_PALETTE }, selectedPalette: "custom" });
  });

  createColorControls();
  chrome.storage.sync.get(api.DEFAULT_SETTINGS, (stored) => {
    if (chrome.runtime.lastError) {
      render();
      showStorageError("Could not load synced settings. Using defaults.");
      refreshActiveTabStatus();
      return;
    }
    settings = api.normalizeSettings(stored);
    persistedSettings = settings;
    render();
    refreshActiveTabStatus();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    const changedValues = Object.fromEntries(
      Object.entries(changes).map(([key, change]) => [key, change.newValue])
    );
    settings = api.normalizeSettings({ ...settings, ...changedValues });
    persistedSettings = settings;
    render();
    refreshActiveTabStatus();
  });
})();
