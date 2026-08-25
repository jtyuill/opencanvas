(function initializePopup() {
  "use strict";

  const api = globalThis.CanvasPalette;
  const siteApi = globalThis.OpenCanvasSite;
  const cardImagesApi = globalThis.OpenCanvasCardImages;
  const transferApi = globalThis.OpenCanvasSettingsTransfer;
  const colorMetadata = {
    background: { label: "Page", description: "Main Canvas background" },
    surface: { label: "Surface", description: "Navigation and panels" },
    surfaceRaised: { label: "Raised", description: "Cards and menus" },
    text: { label: "Text", description: "Primary content" },
    muted: { label: "Muted text", description: "Secondary content" },
    border: { label: "Border", description: "Dividers and outlines" },
    accent: { label: "Accent", description: "Links and actions" }
  };

  const enabledInput = document.querySelector("#enabled");
  const paletteSelect = document.querySelector("#palette-select");
  const colorGrid = document.querySelector("#color-grid");
  const statusLine = document.querySelector("#status-line");
  const statusDot = document.querySelector("#status-dot");
  const statusText = document.querySelector("#status-text");
  const preview = document.querySelector("#preview");
  const customPreview = document.querySelector("#custom-preview");
  const resetButton = document.querySelector("#reset");
  const homeView = document.querySelector("#home-view");
  const customView = document.querySelector("#custom-view");
  const editCustomButton = document.querySelector("#edit-custom");
  const backButton = document.querySelector("#back");
  const storageError = document.querySelector("#storage-error");
  const siteForm = document.querySelector("#site-form");
  const schoolInput = document.querySelector("#school-url");
  const connectButton = document.querySelector("#connect-site");
  const exportButton = document.querySelector("#export-settings");
  const importButton = document.querySelector("#import-settings");
  const importFileInput = document.querySelector("#import-file");
  const transferStatus = document.querySelector("#transfer-status");
  let settings = api.normalizeSettings(api.DEFAULT_SETTINGS);
  let persistedSettings = settings;
  let tabStatus = "checking";
  let activeView = "home";

  function save(changes) {
    const previousSettings = persistedSettings;
    const proposedSettings = api.normalizeSettings({ ...settings, ...changes });
    settings = proposedSettings;
    render();
    chrome.storage.sync.set(changes, () => {
      if (chrome.runtime.lastError) {
        settings = previousSettings;
        if (activeView === "custom" && previousSettings.selectedPalette !== "custom") activeView = "home";
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
  function setTransferStatus(message) {
    transferStatus.textContent = message;
  }

  function storageGet(area, defaults) {
    return new Promise((resolve, reject) => {
      area.get(defaults, (stored) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Could not read extension storage."));
          return;
        }
        resolve(stored);
      });
    });
  }

  function storageSet(area, values) {
    return new Promise((resolve, reject) => {
      area.set(values, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Could not write extension storage."));
          return;
        }
        resolve();
      });
    });
  }

  function connectImportedSchool(baseUrl) {
    if (!baseUrl) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const pattern = siteApi.originPattern(baseUrl);
      chrome.permissions.request({ origins: [pattern] }, (granted) => {
        if (chrome.runtime.lastError || !granted) {
          reject(new Error("OpenCanvas needs access to the imported Canvas site."));
          return;
        }
        chrome.runtime.sendMessage({ type: "opencanvas:set-school", baseUrl }, (response) => {
          if (chrome.runtime.lastError || !response || !response.ok) {
            reject(new Error(response && response.error ? response.error : "Could not connect to the imported Canvas site."));
            return;
          }
          resolve();
        });
      });
    });
  }

  function downloadSettingsFile(contents) {
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "opencanvas-settings.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportSettings() {
    clearStorageError();
    setTransferStatus("");
    exportButton.disabled = true;
    try {
      const stored = await storageGet(chrome.storage.local, { [cardImagesApi.STORAGE_KEY]: {} });
      const contents = transferApi.serializeSettingsFile(
        persistedSettings,
        stored[cardImagesApi.STORAGE_KEY]
      );
      downloadSettingsFile(contents);
      setTransferStatus("Settings exported.");
    } catch {
      showStorageError("Could not export settings. Please try again.");
    } finally {
      exportButton.disabled = false;
    }
  }

  async function importSettingsFile(file) {
    clearStorageError();
    setTransferStatus("");
    importButton.disabled = true;
    try {
      if (file.size > transferApi.MAX_FILE_BYTES) {
        throw new Error("The settings file is larger than 10 MB.");
      }
      const imported = transferApi.parseSettingsFile(await file.text());
      await connectImportedSchool(imported.settings.schoolBaseUrl);
      await Promise.all([
        storageSet(chrome.storage.sync, imported.settings),
        storageSet(chrome.storage.local, { [cardImagesApi.STORAGE_KEY]: imported.images })
      ]);
      settings = imported.settings;
      persistedSettings = settings;
      activeView = "home";
      render();
      refreshActiveTabStatus();
      setTransferStatus("Settings imported.");
    } catch (error) {
      showStorageError(error instanceof Error ? error.message : "Could not import settings.");
    } finally {
      importButton.disabled = false;
    }
  }


  function createColorControls() {
    api.COLOR_KEYS.forEach((key) => {
      const metadata = colorMetadata[key];
      const control = document.createElement("div");
      const label = document.createElement("label");
      const name = document.createElement("span");
      const description = document.createElement("span");
      const textInput = document.createElement("input");
      const picker = document.createElement("input");

      control.className = "color-control";
      label.className = "color-copy";
      label.htmlFor = `color-${key}`;
      name.className = "color-name";
      name.textContent = metadata.label;
      description.className = "color-description";
      description.textContent = metadata.description;
      label.append(name, description);

      textInput.className = "color-text";
      textInput.type = "text";
      textInput.dataset.colorText = key;
      textInput.setAttribute("aria-label", `${metadata.label} hex color`);
      textInput.maxLength = 7;
      textInput.spellcheck = false;

      picker.id = `color-${key}`;
      picker.className = "color-picker";
      picker.type = "color";
      picker.dataset.colorKey = key;
      picker.setAttribute("aria-label", `Choose ${metadata.label.toLowerCase()} color`);

      control.append(label, textInput, picker);
      colorGrid.append(control);
    });
  }

  function renderPreview(target, palette) {
    const names = {
      background: "--preview-background",
      surface: "--preview-surface",
      surfaceRaised: "--preview-raised",
      text: "--preview-text",
      muted: "--preview-muted",
      border: "--preview-border",
      accent: "--preview-accent"
    };
    Object.entries(names).forEach(([key, name]) => target.style.setProperty(name, palette[key]));
    target.style.setProperty("--preview-accent-text", api.paletteToVariables(palette)["--ct-accent-text"]);
  }


  function renderStatus() {
    const messages = {
      paused: "Theme paused on this Canvas tab",
      unavailable: "Unavailable on this tab",
      checking: "Checking active tab",
      unconfigured: "Choose your Canvas site"
    };
    statusLine.hidden = tabStatus === "active";
    statusDot.classList.toggle("active", tabStatus === "active");
    statusText.textContent = messages[tabStatus] || "";
  }

  function refreshActiveTabStatus() {
    if (!settings.schoolBaseUrl) {
      tabStatus = "unconfigured";
      renderStatus();
      return;
    }
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
      chrome.tabs.sendMessage(tabs[0].id, { type: "opencanvas:get-status" }, { frameId: 0 }, (response) => {
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
    schoolInput.value = settings.schoolBaseUrl;
    connectButton.textContent = settings.schoolBaseUrl ? "Update" : "Connect";
    editCustomButton.hidden = settings.selectedPalette !== "custom";

    colorGrid.querySelectorAll("[data-color-key]").forEach((input) => {
      input.value = settings.customPalette[input.dataset.colorKey];
    });
    colorGrid.querySelectorAll("[data-color-text]").forEach((input) => {
      input.value = settings.customPalette[input.dataset.colorText];
      input.setAttribute("aria-invalid", "false");
    });

    homeView.hidden = activeView !== "home";
    customView.hidden = activeView !== "custom";
    renderPreview(preview, palette);
    renderPreview(customPreview, settings.customPalette);
    renderStatus();
  }

  enabledInput.addEventListener("change", () => save({ enabled: enabledInput.checked }));

  paletteSelect.addEventListener("change", () => {
    if (paletteSelect.value === "custom") activeView = "custom";
    save({ selectedPalette: paletteSelect.value });
  });

  editCustomButton.addEventListener("click", () => {
    activeView = "custom";
    render();
  });

  backButton.addEventListener("click", () => {
    activeView = "home";
    render();
  });

  colorGrid.addEventListener("input", (event) => {
    const picker = event.target.closest("[data-color-key]");
    if (picker) {
      const customPalette = { ...settings.customPalette, [picker.dataset.colorKey]: picker.value };
      settings = api.normalizeSettings({ ...settings, customPalette, selectedPalette: "custom" });
      render();
      return;
    }

    const textInput = event.target.closest("[data-color-text]");
    if (!textInput) return;
    const normalized = textInput.value.trim().toLowerCase();
    textInput.setAttribute("aria-invalid", String(!api.isHexColor(normalized)));
  });

  colorGrid.addEventListener("change", (event) => {
    const picker = event.target.closest("[data-color-key]");
    if (picker) {
      save({ customPalette: settings.customPalette, selectedPalette: "custom" });
      return;
    }

    const textInput = event.target.closest("[data-color-text]");
    if (!textInput) return;
    const normalized = textInput.value.trim().toLowerCase();
    if (!api.isHexColor(normalized)) {
      textInput.value = settings.customPalette[textInput.dataset.colorText];
      textInput.setAttribute("aria-invalid", "false");
      return;
    }
    const customPalette = { ...settings.customPalette, [textInput.dataset.colorText]: normalized };
    save({ customPalette, selectedPalette: "custom" });
  });

  exportButton.addEventListener("click", exportSettings);

  importButton.addEventListener("click", () => importFileInput.click());

  importFileInput.addEventListener("change", () => {
    const file = importFileInput.files && importFileInput.files[0];
    importFileInput.value = "";
    if (file) importSettingsFile(file);
  });

  resetButton.addEventListener("click", () => {
    save({ customPalette: { ...api.DARK_PALETTE }, selectedPalette: "custom" });
  });

  siteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const baseUrl = siteApi.normalizeBaseUrl(schoolInput.value);
    if (!baseUrl) {
      showStorageError("Enter a valid HTTPS Canvas URL.");
      return;
    }

    const pattern = siteApi.originPattern(baseUrl);
    chrome.permissions.request({ origins: [pattern] }, (granted) => {
      if (chrome.runtime.lastError || !granted) {
        showStorageError("OpenCanvas needs access to that Canvas site.");
        return;
      }
      chrome.runtime.sendMessage({ type: "opencanvas:set-school", baseUrl }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          showStorageError(response && response.error ? response.error : "Could not connect to that Canvas site.");
          return;
        }
        settings = api.normalizeSettings({ ...settings, schoolBaseUrl: response.baseUrl });
        persistedSettings = settings;
        clearStorageError();
        render();
        refreshActiveTabStatus();
      });
    });
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
